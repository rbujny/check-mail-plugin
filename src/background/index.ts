/// <reference types="chrome" />
import type { ProcessedEmailData } from '../shared/types';
import { getValidToken, invalidateToken } from './auth-client';
import { PROCESS_URL, withApiKey } from './api-config';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PROCESS_EMAIL' && message.payload) {
        processEmailPayload(message.payload, sender.tab?.id);
    }
});

export async function processEmailPayload(payload: ProcessedEmailData, tabId: number | undefined) {
    if (tabId) {
        chrome.action.setBadgeText({ text: '⏳', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#fbbc04', tabId });
    }

    const maxRetries = 3;
    let attempt = 0;
    let success = false;

    let tokenRefreshed = false;

    let lastError: string | null = null;

    try {
        let token = await getValidToken();

        while (attempt < maxRetries && !success) {
            attempt++;
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);

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
                    console.warn('[CheckMailPlugin Background] 401 Unauthorized — refreshing token.');
                    invalidateToken();
                    token = await getValidToken();
                    tokenRefreshed = true;
                    attempt--;
                } else {
                    const errorText = await response.text().catch(() => '');
                    throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
                }
            } catch (error) {
                lastError = error instanceof Error ? error.message : String(error);
                console.error(`[CheckMailPlugin Background] Attempt ${attempt} failed:`, error);
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
    } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.error('[CheckMailPlugin Background] Token acquisition failed:', error);
    }

    if (tabId) {
        chrome.action.setBadgeText({ text: '', tabId });
    }

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
