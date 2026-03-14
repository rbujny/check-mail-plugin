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
        }
    });
});

import { processEmailPayload } from '../index';

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
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should successfully send data and update badges on the first attempt', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true });

        const promise = processEmailPayload(mockPayload, tabId);
        await vi.runAllTimersAsync();
        await promise;

        // Check badge updates
        expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '⏳', tabId });
        expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#fbbc04', tabId });

        // Final badge clearing
        expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: '', tabId });

        // Fetch check
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/process.php', expect.any(Object));

        // No error toast sent
        expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });

    it('should retry up to 3 times on failure and eventually fail', async () => {
        fetchMock.mockRejectedValue(new Error('Network Error'));

        const promise = processEmailPayload(mockPayload, tabId);

        // Each attempt has a 1s delay if not the last one
        // Attempt 1 fails -> wait 1s -> Attempt 2 fails -> wait 1s -> Attempt 3 fails -> end
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
            .mockResolvedValueOnce({ ok: true });

        const promise = processEmailPayload(mockPayload, tabId);
        await vi.runAllTimersAsync();
        await promise;

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle AbortController timeout (simulated)', async () => {
        // To test timeout logic we'd ideally need to check if the signal is aborted.
        // We can verify that AbortController is used in the fetch call.
        fetchMock.mockResolvedValueOnce({ ok: true });

        await processEmailPayload(mockPayload, tabId);

        const fetchOptions = fetchMock.mock.calls[0][1];
        expect(fetchOptions.signal).toBeDefined();
        expect(fetchOptions.signal instanceof AbortSignal).toBe(true);
    });
});
