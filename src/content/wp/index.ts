
import { injectWpStandardIcon, injectWpRawIcon } from './wp-injector';
import { setupMessageListener } from '../shared/toast';

function debounce(fn: () => void, delayMs: number): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(fn, delayMs);
    };
}

function processWpView(): void {
    try {
        injectWpStandardIcon();
        injectWpRawIcon();
    } catch (error) {
        console.error('[CheckMailPlugin][WP] Error processing view:', error);
    }
}

const debouncedProcess = debounce(processWpView, 300);

function init(): void {
    console.log('[CheckMailPlugin] WP Mail content script loaded.');

    setupMessageListener();

    processWpView();

    const observer = new MutationObserver(() => {
        debouncedProcess();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
