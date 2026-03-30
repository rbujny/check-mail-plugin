/**
 * Content script entry point for Interia Mail (poczta.interia.pl).
 *
 * Detects whether the user is on the standard message view or the
 * "Pokaż nagłówki" / "Źródło wiadomości" page and triggers the
 * appropriate injection.
 */

import { injectInteriaStandardIcon, injectInteriaRawIcon } from './interia-injector';
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
 * Determines if the current page is an Interia "raw source" view.
 */
function isRawView(): boolean {
    const url = window.location.href;
    // Interia raw view detection: URL may contain source/header indicators
    if (/[?&]view=source/i.test(url) || /\/source\b/i.test(url) || /[?&]headers/i.test(url)) {
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
 * Process the current Interia Mail view and inject the appropriate UI element.
 */
function processInteriaView(): void {
    try {
        if (isRawView()) {
            injectInteriaRawIcon();
        } else {
            injectInteriaStandardIcon();
        }
    } catch (error) {
        // Graceful failure: log and do not break Interia Mail
        console.error('[CheckMailPlugin][Interia] Error processing view:', error);
    }
}

const debouncedProcess = debounce(processInteriaView, 300);

/**
 * Initialize the Interia Mail content script.
 */
function init(): void {
    console.log('[CheckMailPlugin] Interia Mail content script loaded.');

    // Setup listener for background responses (like errors)
    setupMessageListener();

    // Initial scan
    processInteriaView();

    // Observe for Interia Mail SPA navigation and dynamic content loading
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
