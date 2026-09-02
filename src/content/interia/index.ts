
import { injectInteriaStandardIcon, injectInteriaRawIcon } from './interia-injector';
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
    if (/[?&]view=source/i.test(url) || /\/source\b/i.test(url) || /[?&]headers/i.test(url)) {
        return true;
    }
    const pre = document.querySelector('pre');
    if (pre && pre.textContent && pre.textContent.includes('Received:')) {
        return true;
    }
    return false;
}

function processInteriaView(): void {
    try {
        if (isRawView()) {
            injectInteriaRawIcon();
        } else {
            injectInteriaStandardIcon();
        }
    } catch (error) {
        console.error('[CheckMailPlugin][Interia] Error processing view:', error);
    }
}

const debouncedProcess = debounce(processInteriaView, 300);

function init(): void {
    console.log('[CheckMailPlugin] Interia Mail content script loaded.');

    setupMessageListener();

    processInteriaView();

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
