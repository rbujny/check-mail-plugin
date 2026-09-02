
import { injectYahooStandardIcon, injectYahooRawIcon } from './yahoo-injector';
import { setupMessageListener } from '../shared/toast';

function debounce(fn: () => void, delayMs: number): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(fn, delayMs);
    };
}

function isRawView(): boolean {
    const isRawPath = /\/messages\/[^/]+\/raw\b/.test(window.location.pathname);
    const isApiDomain = window.location.hostname === 'apis.mail.yahoo.com';
    return isRawPath || isApiDomain;
}

function processYahooView(): void {
    try {
        if (isRawView()) {
            injectYahooRawIcon();
        } else {
            injectYahooStandardIcon();
        }
    } catch (error) {
        console.error('[CheckMailPlugin][Yahoo] Error processing view:', error);
    }
}

const debouncedProcess = debounce(processYahooView, 300);

function init(): void {
    console.log('[CheckMailPlugin] Yahoo Mail content script loaded.');

    setupMessageListener();

    processYahooView();

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
