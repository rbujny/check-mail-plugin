
import { injectOutlookStandardIcon, injectOutlookRawIcon } from './outlook-injector';
import { setupMessageListener } from '../shared/toast';

function debounce(fn: () => void, delayMs: number): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(fn, delayMs);
    };
}

function processOutlookView(): void {
    try {
        injectOutlookStandardIcon();
        injectOutlookRawIcon();
    } catch (error) {
        console.error('[CheckMailPlugin][Outlook] Error processing view:', error);
    }
}

const debouncedProcess = debounce(processOutlookView, 300);

function init(): void {
    console.log('[CheckMailPlugin] Outlook content script loaded.');

    setupMessageListener();

    processOutlookView();

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
