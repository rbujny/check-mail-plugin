/**
 * Content script entry point for Outlook Web.
 */

import { injectOutlookStandardIcon, injectOutlookRawIcon } from './outlook-injector';
import { setupMessageListener } from '../toast';

/**
 * Debounce utility.
 */
function debounce(fn: () => void, delayMs: number): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(fn, delayMs);
    };
}

/**
 * Process the current Outlook view.
 */
function processOutlookView(): void {
    try {
        // Handle both standard view and raw source view
        injectOutlookStandardIcon();
        injectOutlookRawIcon();
    } catch (error) {
        console.error('[CheckMailPlugin][Outlook] Error processing view:', error);
    }
}

const debouncedProcess = debounce(processOutlookView, 300);

/**
 * Initialize the Outlook content script.
 */
function init(): void {
    console.log('[CheckMailPlugin] Outlook content script loaded.');

    setupMessageListener();

    // Initial scan
    processOutlookView();

    // Observe for Outlook SPA navigation and dynamic content
    const observer = new MutationObserver(() => {
        debouncedProcess();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
