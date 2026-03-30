/**
 * Content script entry point for Onet Mail (poczta.onet.pl).
 *
 * Detects whether the user is on the standard message view or the
 * "Pokaż źródło wiadomości" (Show message source) page and triggers
 * the appropriate injection.
 */

import { injectOnetStandardIcon, injectOnetRawIcon } from './onet-injector';
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
 * Determines if the current page is an Onet "raw source" view.
 */
function isRawView(): boolean {
    const url = window.location.href;
    // Onet raw view detection: URL may contain source indicators
    if (/[?&]view=source/i.test(url) || /\/source\b/i.test(url)) {
        return true;
    }
    // Fallback: if the page is primarily a <pre> element with MIME content
    const pre = document.querySelector('pre');
    if (pre && pre.textContent && pre.textContent.includes('Received:')) {
        return true;
    }
    return false;
}

/**
 * Process the current Onet Mail view and inject the appropriate UI element.
 */
function processOnetView(): void {
    try {
        if (isRawView()) {
            injectOnetRawIcon();
        } else {
            injectOnetStandardIcon();
        }
    } catch (error) {
        // Graceful failure: log and do not break Onet Mail
        console.error('[CheckMailPlugin][Onet] Error processing view:', error);
    }
}

const debouncedProcess = debounce(processOnetView, 300);

/**
 * Initialize the Onet Mail content script.
 */
function init(): void {
    console.log('[CheckMailPlugin] Onet Mail content script loaded.');

    // Setup listener for background responses (like errors)
    setupMessageListener();

    // Initial scan
    processOnetView();

    // Observe for Onet Mail SPA navigation and dynamic content loading
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
