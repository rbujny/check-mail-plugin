/**
 * Content script entry point for WP Mail (poczta.wp.pl).
 *
 * Detects whether the user is on the standard message view or the
 * "Pokaż źródło" (Show source) page and triggers the appropriate injection.
 */

import { injectWpStandardIcon, injectWpRawIcon } from './wp-injector';
import { setupMessageListener } from '../shared/toast';

/**
 * Debounce utility to prevent excessive DOM processing during
 * rapid mutation events.
 */
function debounce(fn: () => void, delayMs: number): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(fn, delayMs);
    };
}

/**
 * Process the current WP Mail view and inject the appropriate UI elements.
 */
function processWpView(): void {
    try {
        injectWpStandardIcon();
        injectWpRawIcon();
    } catch (error) {
        // Graceful failure: log and do not break WP Mail
        console.error('[CheckMailPlugin][WP] Error processing view:', error);
    }
}

const debouncedProcess = debounce(processWpView, 300);

/**
 * Initialize the WP Mail content script.
 */
function init(): void {
    console.log('[CheckMailPlugin] WP Mail content script loaded.');

    // Setup listener for background responses (like errors)
    setupMessageListener();

    // Initial scan
    processWpView();

    // Observe for WP Mail SPA navigation and dynamic content loading
    const observer = new MutationObserver(() => {
        debouncedProcess();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
}

// Wait for DOM to be ready, then initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
