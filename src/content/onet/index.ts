/**
 * Content script entry point for Onet Mail (poczta.onet.pl).
 *
 * Detects whether the user is on the standard message view or the
 * "Pokaż źródło wiadomości" (Show message source) page and triggers
 * the appropriate injection.
 *
 * Onet is a SPA that renders asynchronously — the toolbar and message
 * content may not be present when the content script first runs.
 * We handle this with an aggressive multi-strategy approach:
 * 1. Immediate attempt on load
 * 2. Persistent polling every 1 second for 30 seconds
 * 3. MutationObserver for ongoing SPA navigation and modal detection
 * 4. Resize event listener (resizing is known to trigger Onet re-renders)
 * 5. SPA navigation events (hashchange, popstate)
 */

import { injectOnetStandardIcon, injectOnetRawIcon, injectOnetHeadersModalIcon } from './onet-injector';
import { ICON_MARKER } from '../gmail/icon-injector';
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
 * Determines if the current page is an Onet "raw source" view
 * (opened in a separate tab, not the in-page modal).
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
 * Check if the standard icon is already injected.
 */
function isStandardIconPresent(): boolean {
    return !!document.querySelector(`[${ICON_MARKER}="true"]`);
}

/**
 * Process the current Onet Mail view and inject the appropriate UI element.
 * Also handles the "Nagłówki wiadomości" headers modal when detected.
 */
function processOnetView(): void {
    try {
        if (isRawView()) {
            injectOnetRawIcon();
        } else {
            // Always attempt standard icon injection
            injectOnetStandardIcon();

            // Also check for the headers modal (can appear alongside standard view)
            injectOnetHeadersModalIcon();
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

    // ── Persistent polling ──────────────────────────────────────
    // Onet is a SPA that renders the toolbar asynchronously and
    // unpredictably. One-shot timeouts are insufficient.
    // Poll every 1 second for up to 30 seconds.
    let retryCount = 0;
    const MAX_RETRIES = 30;
    const pollInterval = setInterval(() => {
        retryCount++;
        if (isStandardIconPresent() || retryCount >= MAX_RETRIES) {
            clearInterval(pollInterval);
            if (isStandardIconPresent()) {
                console.log(`[CheckMailPlugin][Onet] Icon injected after ${retryCount}s of polling.`);
            } else {
                console.warn('[CheckMailPlugin][Onet] Toolbar not found after 30s of polling.');
            }
            return;
        }
        processOnetView();
    }, 1000);

    // ── Resize listener ─────────────────────────────────────────
    // Resizing the window is known to trigger Onet re-renders,
    // which makes the toolbar available. Listen for this event.
    window.addEventListener('resize', () => {
        if (!isStandardIconPresent()) {
            // Small delay to let Onet finish its resize re-render
            setTimeout(processOnetView, 200);
        }
    });

    // ── SPA navigation listeners ────────────────────────────────
    // Onet uses SPA-style navigation; capture route changes.
    window.addEventListener('hashchange', debouncedProcess);
    window.addEventListener('popstate', debouncedProcess);

    // ── MutationObserver ─────────────────────────────────────────
    // Observe for Onet Mail SPA navigation, dynamic content loading,
    // and modal appearances (e.g. "Nagłówki wiadomości" dialog).
    // Also observe attribute changes — Onet's framework may toggle
    // visibility or data attributes without adding/removing nodes.
    const observer = new MutationObserver(() => {
        debouncedProcess();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'aria-hidden', 'data-state'],
    });
}

// Wait for DOM to be ready, then initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
