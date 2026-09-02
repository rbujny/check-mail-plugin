
import { injectOnetStandardIcon, injectOnetRawIcon, injectOnetHeadersModalIcon } from './onet-injector';
import { ICON_MARKER } from '../gmail/icon-injector';
import { setupMessageListener } from '../shared/toast';

function debounce(fn: () => void, delayMs: number): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(fn, delayMs);
    };
}

function isRawView(): boolean {
    const url = window.location.href;
    if (/[?&]view=source/i.test(url) || /\/source\b/i.test(url)) {
        return true;
    }
    const pre = document.querySelector('pre');
    if (pre && pre.textContent && pre.textContent.includes('Received:')) {
        return true;
    }
    return false;
}

function isStandardIconPresent(): boolean {
    return !!document.querySelector(`[${ICON_MARKER}="true"]`);
}

function processOnetView(): void {
    try {
        if (isRawView()) {
            injectOnetRawIcon();
        } else {
            injectOnetStandardIcon();

            injectOnetHeadersModalIcon();
        }
    } catch (error) {
        console.error('[CheckMailPlugin][Onet] Error processing view:', error);
    }
}

const debouncedProcess = debounce(processOnetView, 300);

function init(): void {
    console.log('[CheckMailPlugin] Onet Mail content script loaded.');

    setupMessageListener();

    processOnetView();

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

    window.addEventListener('resize', () => {
        if (!isStandardIconPresent()) {
            setTimeout(processOnetView, 200);
        }
    });

    window.addEventListener('hashchange', debouncedProcess);
    window.addEventListener('popstate', debouncedProcess);

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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
