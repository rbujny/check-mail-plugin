/**
 * Content script entry point for CheckMailPlugin (Gmail).
 *
 * Sets up a MutationObserver to watch Gmail's DOM for email view
 * changes, and triggers icon injection/cleanup accordingly.
 */

import { injectIcons, cleanupIcons } from './icon-injector';
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
 * Scans the DOM for expanded email message containers and
 * triggers injection/cleanup of CheckMailPlugin icons.
 */
function processEmailView(): void {
    try {
        cleanupIcons();
        injectIcons();
    } catch (error) {
        console.error('[CheckMailPlugin] Error processing email view:', error);
    }
}

const debouncedProcess = debounce(processEmailView, 300);

/**
 * Initialize the content script: set up a MutationObserver
 * on document.body to detect Gmail DOM changes.
 */
function init(): void {
    // Prevent this simplified observer from running on the "Show Original" page
    // where it conflicts with the dedicated original extractor
    if (window.location.search.includes('view=om')) {
        return;
    }

    console.log('[CheckMailPlugin] Content script loaded on Gmail.');

    // Setup listener for background responses (like errors)
    setupMessageListener();

    // Initial scan in case an email is already open
    processEmailView();

    // Observe for Gmail navigation (SPA route changes, thread expansion, etc.)
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
