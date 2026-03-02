/**
 * Content script entry point for Show Original View in Gmail.
 */

import { injectOriginalIcon } from './show-original-injector';

function initOriginalView(): void {
    console.log('[CheckMailPlugin] Original View loaded.');

    // Inject immediately
    injectOriginalIcon();

    // Since show original is a mostly static page, mutation observers 
    // aren't as strictly necessary, but we can set up a light one just in case
    // Gmail loads content dynamically.
    const observer = new MutationObserver(() => {
        injectOriginalIcon();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOriginalView);
} else {
    initOriginalView();
}
