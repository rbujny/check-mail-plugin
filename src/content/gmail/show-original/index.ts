
import { injectOriginalIcon } from './injector';
import { setupMessageListener } from '../../shared/toast';

function initOriginalView(): void {
    console.log('[CheckMailPlugin] Original View loaded.');

    setupMessageListener();

    injectOriginalIcon();

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
