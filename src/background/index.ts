/// <reference types="chrome" />
import type { ProcessedEmailData } from '../shared/types';
import { getValidToken, invalidateToken } from './auth-client';
import { PROCESS_URL, withApiKey } from './api-config';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PROCESS_EMAIL' && message.payload) {
        // Pass the request to the processing background function
        processEmailPayload(message.payload, sender.tab?.id);
    }
});

export async function processEmailPayload(payload: ProcessedEmailData, tabId: number | undefined) {
    if (tabId) {
        // T006: Add a visible transmission indicator
        chrome.action.setBadgeText({ text: '⏳', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#fbbc04', tabId });
    }

    const maxRetries = 3;
    let attempt = 0;
    let success = false;

    // Guard: allow at most one token refresh per processEmailPayload
    // call to prevent infinite loops when /token keeps returning
    // a JWT that the backend immediately rejects as 401.
    let tokenRefreshed = false;

    let lastError: string | null = null;

    try {
        // Obtain a valid JWT (cached or freshly issued)
        let token = await getValidToken();

        // T005: 3-attempt retry mechanism
        while (attempt < maxRetries && !success) {
            attempt++;
            try {
                // T004: Wire up AbortController with a 30-second timeout signal
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);

                // T003: Authorised POST request to the /process endpoint
                const response = await fetch(withApiKey(PROCESS_URL), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    if (tabId) {
                        chrome.tabs.sendMessage(tabId, {
                            type: 'SHOW_SCAN_RESULT',
                            payload: data
                        });
                    }
                    success = true;
                } else if (response.status === 401 && !tokenRefreshed) {
                    // Token was rejected — clear cache, get a fresh one,
                    // and retry this attempt (do not increment counter).
                    console.warn('[CheckMailPlugin Background] 401 Unauthorized — refreshing token.');
                    invalidateToken();
                    token = await getValidToken();
                    tokenRefreshed = true;
                    attempt--; // do not count this as a retry attempt
                } else {
                    const errorText = await response.text().catch(() => '');
                    throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
                }
            } catch (error) {
                lastError = error instanceof Error ? error.message : String(error);
                console.error(`[CheckMailPlugin Background] Attempt ${attempt} failed:`, error);
                if (attempt < maxRetries) {
                    // 1-second delay between attempts
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
    } catch (error) {
        // Token acquisition itself failed
        lastError = error instanceof Error ? error.message : String(error);
        console.error('[CheckMailPlugin Background] Token acquisition failed:', error);
    }

    if (tabId) {
        // Clear badge when done processing
        chrome.action.setBadgeText({ text: '', tabId });
    }

    // T008: Send a failure message back to the active tab's content script upon exhaustion of retries
    if (!success && tabId) {
        const errorMsg = lastError
            ? `Transmission failed: ${lastError}`
            : 'Data transmission failed. Request could not be handled.';
        chrome.tabs.sendMessage(tabId, {
            type: 'SHOW_TOAST_ERROR',
            message: errorMsg
        });
    }
}
