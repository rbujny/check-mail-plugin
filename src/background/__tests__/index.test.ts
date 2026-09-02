import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.hoisted(() => {
    vi.stubGlobal('chrome', {
        action: {
            setBadgeText: vi.fn(),
            setBadgeBackgroundColor: vi.fn(),
        },
        tabs: {
            sendMessage: vi.fn(),
        },
        runtime: {
            onMessage: {
                addListener: vi.fn(),
            },
        },
        storage: {
            local: {
                get: vi.fn(async () => ({ checkmail_client_id: 'test-uuid' })),
                set: vi.fn(async () => {}),
            },
        },
    });
});

const getValidTokenMock = vi.fn<() => Promise<string>>();
const invalidateTokenMock = vi.fn();

vi.mock('../auth-client', () => ({
    getValidToken: (...args: unknown[]) => getValidTokenMock(...(args as [])),
    invalidateToken: (...args: unknown[]) => invalidateTokenMock(...(args as [])),
}));

import { processEmailPayload } from '../index';
import { PROCESS_URL } from '../api-config';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('background service worker', () => {
    const mockPayload: any = {
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        cc: [],
        subject: 'Test',
        date: 'Mon, 9 Mar 2026 12:00:00 +0100',
        bodyText: 'Hello',
        body: 'Hello',
        links: [],
        truncated: false,
        extractionTimestamp: new Date().toISOString(),
        headers: {},
        receivedChain: [],
        securityVerdicts: { spf: 'none', dkim: 'none', dmarc: 'none' }
    };
    const tabId = 123;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        getValidTokenMock.mockResolvedValue('mock-jwt-token');
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should call getValidToken before making the process request', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ result: 'OK', comment: 'Safe' }) });

        const promise = processEmailPayload(mockPayload, tabId);
        await vi.runAllTimersAsync();
        await promise;

        expect(getValidTokenMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should successfully send data with Authorization header and update badges', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ result: 'OK', comment: 'Safe' }) });

        const promise = processEmailPayload(mockPayload, tabId);
        await vi.runAllTimersAsync();
        await promise;

        expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '⏳', tabId });
        expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#fbbc04', tabId });

        expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: '', tabId });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toContain('/process');
        expect(options.headers['Authorization']).toBe('Bearer mock-jwt-token');
        expect(options.headers['Content-Type']).toBe('application/json');

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(tabId, {
            type: 'SHOW_SCAN_RESULT',
            payload: { result: 'OK', comment: 'Safe' }
        });
    });

    it('should retry up to 3 times on failure and eventually fail', async () => {
        fetchMock.mockRejectedValue(new Error('Network Error'));

        const promise = processEmailPayload(mockPayload, tabId);
        await vi.runAllTimersAsync();
        await promise;

        expect(fetchMock).toHaveBeenCalledTimes(3);

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(tabId, {
            type: 'SHOW_TOAST_ERROR',
            message: expect.stringMatching(/transmission failed/i)
        });

        expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: '', tabId });
    });

    it('should succeed on a retry attempt', async () => {
        fetchMock
            .mockRejectedValueOnce(new Error('Fail 1'))
            .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 'WARNING', comment: 'Suspicious' }) });

        const promise = processEmailPayload(mockPayload, tabId);
        await vi.runAllTimersAsync();
        await promise;

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(tabId, {
            type: 'SHOW_SCAN_RESULT',
            payload: { result: 'WARNING', comment: 'Suspicious' }
        });
    });

    it('should handle AbortController timeout (simulated)', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ result: 'OK', comment: '' }) });

        await processEmailPayload(mockPayload, tabId);

        const fetchOptions = fetchMock.mock.calls[0][1];
        expect(fetchOptions.signal).toBeDefined();
        expect(fetchOptions.signal instanceof AbortSignal).toBe(true);
    });

    it('should refresh token and retry on 401 Unauthorized', async () => {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
        getValidTokenMock
            .mockResolvedValueOnce('mock-jwt-token')
            .mockResolvedValueOnce('mock-jwt-token-fresh');
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ result: 'OK', comment: 'Fine' }) });

        const promise = processEmailPayload(mockPayload, tabId);
        await vi.runAllTimersAsync();
        await promise;

        expect(invalidateTokenMock).toHaveBeenCalledTimes(1);
        expect(getValidTokenMock).toHaveBeenCalledTimes(2);
        expect(fetchMock).toHaveBeenCalledTimes(2);

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(tabId, {
            type: 'SHOW_SCAN_RESULT',
            payload: { result: 'OK', comment: 'Fine' }
        });
    });

    it('should fail if token acquisition throws', async () => {
        getValidTokenMock.mockRejectedValue(new Error('Token endpoint down'));

        const promise = processEmailPayload(mockPayload, tabId);
        await vi.runAllTimersAsync();
        await promise;

        expect(fetchMock).not.toHaveBeenCalled();

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(tabId, {
            type: 'SHOW_TOAST_ERROR',
            message: expect.stringMatching(/transmission failed/i)
        });

        expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: '', tabId });
    });
});
