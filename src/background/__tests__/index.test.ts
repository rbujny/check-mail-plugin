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

// ── Mock auth-client ────────────────────────────────────────────
const getValidTokenMock = vi.fn<() => Promise<string>>();
const invalidateTokenMock = vi.fn();

vi.mock('../auth-client', () => ({
    getValidToken: (...args: unknown[]) => getValidTokenMock(...(args as [])),
    invalidateToken: (...args: unknown[]) => invalidateTokenMock(...(args as [])),
}));

import { processEmailPayload } from '../index';
import { PROCESS_URL } from '../api-config';

// Mock global fetch
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
        // Default: getValidToken returns a mock JWT
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

        // Token must be obtained first
        expect(getValidTokenMock).toHaveBeenCalledTimes(1);
        // Then fetch must be called
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should successfully send data with Authorization header and update badges', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ result: 'OK', comment: 'Safe' }) });

        const promise = processEmailPayload(mockPayload, tabId);
        await vi.runAllTimersAsync();
        await promise;

        // Check badge updates
        expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '⏳', tabId });
        expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#fbbc04', tabId });

        // Final badge clearing
        expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: '', tabId });

        // Fetch check: correct URL and Authorization header
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toContain('/process');
        expect(options.headers['Authorization']).toBe('Bearer mock-jwt-token');
        expect(options.headers['Content-Type']).toBe('application/json');

        // Result forwarded to content script
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

        // After 3 failed attempts, it should send a toast error
        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(tabId, {
            type: 'SHOW_TOAST_ERROR',
            message: expect.stringContaining('transmission failed')
        });

        // Badge should still be cleared at the end
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
        // Result forwarded, no error toast
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
        // First call: 401
        fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
        // After token refresh, getValidToken returns a new token
        getValidTokenMock
            .mockResolvedValueOnce('mock-jwt-token')       // initial
            .mockResolvedValueOnce('mock-jwt-token-fresh'); // after invalidation
        // Second fetch: success
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ result: 'OK', comment: 'Fine' }) });

        const promise = processEmailPayload(mockPayload, tabId);
        await vi.runAllTimersAsync();
        await promise;

        // invalidateToken must have been called
        expect(invalidateTokenMock).toHaveBeenCalledTimes(1);
        // getValidToken called twice: initial + refresh
        expect(getValidTokenMock).toHaveBeenCalledTimes(2);
        // Two fetch calls: 401 + success
        expect(fetchMock).toHaveBeenCalledTimes(2);

        // Result forwarded
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

        // No fetch should have been made
        expect(fetchMock).not.toHaveBeenCalled();

        // Toast error sent
        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(tabId, {
            type: 'SHOW_TOAST_ERROR',
            message: expect.stringContaining('transmission failed')
        });

        // Badge cleared
        expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: '', tabId });
    });
});
