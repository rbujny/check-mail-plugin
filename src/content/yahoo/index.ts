/**
 * Content script entry point for Yahoo Mail.
 *
 * Detects whether the user is on the standard message view or the
 * "View Raw Message" page and triggers the appropriate injection.
 *
 * URL patterns:
 * - Standard view:  mail.yahoo.com/d/folders/{id}/messages/{id}
 * - Raw view:       mail.yahoo.com/d/folders/{id}/messages/{id}/raw
 */

import { injectYahooStandardIcon, injectYahooRawIcon } from './yahoo-injector';
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
 * Determines if the current page is a Yahoo "View Raw Message" view.
 * The raw view URL ends with /raw.
 */
function isRawView(): boolean {
    // Matches standard URI or API URI ending in /raw
    const isRawPath = /\/messages\/[^/]+\/raw\b/.test(window.location.pathname);
    const isApiDomain = window.location.hostname === 'apis.mail.yahoo.com';
    return isRawPath || isApiDomain;
}

/**
 * Process the current Yahoo Mail view and inject the appropriate UI element.
 */
function processYahooView(): void {
    try {
        if (isRawView()) {
            injectYahooRawIcon();
        } else {
            injectYahooStandardIcon();
        }
    } catch (error) {
        // Graceful failure: log and do not break Yahoo Mail
        console.error('[CheckMailPlugin][Yahoo] Error processing view:', error);
    }
}

const debouncedProcess = debounce(processYahooView, 300);

/**
 * Initialize the Yahoo Mail content script.
 */
function init(): void {
    console.log('[CheckMailPlugin] Yahoo Mail content script loaded.');

    // Setup listener for background responses (like errors)
    setupMessageListener();

    // Initial scan
    processYahooView();

    // Observe for Yahoo Mail SPA navigation and dynamic content loading
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
