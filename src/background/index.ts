/// <reference types="chrome" />
import type { ProcessedEmailData } from '../shared/types';

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

    // T005: 3-attempt retry mechanism
    while (attempt < maxRetries && !success) {
        attempt++;
        try {
            // T004: Wire up AbortController with a 30-second timeout signal
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            // T003: Implement the base fetch POST request sending ProcessedEmailData
            const response = await fetch('http://localhost:8080/process.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                success = true;
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.error(`[CheckMailPlugin Background] Attempt ${attempt} failed:`, error);
            if (attempt < maxRetries) {
                // 1-second delay between attempts
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    if (tabId) {
        // Clear badge when done processing
        chrome.action.setBadgeText({ text: '', tabId });
    }

    // T008: Send a failure message back to the active tab's content script upon exhaustion of retries
    if (!success && tabId) {
        chrome.tabs.sendMessage(tabId, {
            type: 'SHOW_TOAST_ERROR',
            message: 'Data transmission failed. Request could not be handled.'
        });
    }
}
