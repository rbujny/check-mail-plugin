
import { injectIcons, cleanupIcons } from './icon-injector';
import { setupMessageListener } from '../shared/toast';

function debounce(fn: () => void, delayMs: number): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(fn, delayMs);
    };
}

function processEmailView(): void {
    try {
        cleanupIcons();
        injectIcons();
    } catch (error) {
        console.error('[CheckMailPlugin] Error processing email view:', error);
    }
}

const debouncedProcess = debounce(processEmailView, 300);

function init(): void {
    if (window.location.search.includes('view=om')) {
        return;
    }

    console.log('[CheckMailPlugin] Content script loaded on Gmail.');

    setupMessageListener();

    processEmailView();

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
