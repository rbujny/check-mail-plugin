import { injectProtonIcons } from './proton-injector';

/**
 * Main entry point for the ProtonMail content script.
 */
function init() {
    console.log('[CheckMailPlugin] ProtonMail content script MATCHED and INITIALIZING');
    console.log('[CheckMailPlugin] Current URL:', window.location.href);

    // Add a marker to the window to verify script execution from console
    (window as any).__CheckMailProtonMatched = true;

    // Standard CSS injection for our icon
    const style = document.createElement('style');
    style.id = 'checkmail-proton-styles';
    style.textContent = `
        [data-checkmail-injected] {
            margin: 0 4px !important;
            vertical-align: middle !important;
            transition: all 0.2s ease !important;
        }
        [data-checkmail-injected]:hover {
            background-color: rgba(0, 0, 0, 0.05) !important;
            transform: scale(1.1);
        }
    `;
    document.head.appendChild(style);

    // Initial injection
    injectProtonIcons();

    // Set up MutationObserver to handle dynamic content loading in ProtonMail
    const observer = new MutationObserver((mutations) => {
        let shouldInject = false;
        
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Check if any added nodes are related to message views or modals
                for (const node of Array.from(mutation.addedNodes)) {
                    if (node instanceof HTMLElement) {
                        const targetId = node.getAttribute('data-testid') || '';
                        if (
                            node.querySelector('[data-testid^="message-view"]') ||
                            targetId.startsWith('message-view') ||
                            targetId.startsWith('message-header') ||
                            node.getAttribute('role') === 'dialog' ||
                            node.classList.contains('modal-two') ||
                            node.querySelector('.modal-two')
                        ) {
                            shouldInject = true;
                            break;
                        }
                    }
                }
            }
            if (shouldInject) break;
        }

        if (shouldInject) {
            // Use a small delay to ensure DOM is ready
            setTimeout(injectProtonIcons, 100);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    // Start periodic check as a fallback for React re-renders (inside init)
    setInterval(() => {
        injectProtonIcons();
    }, 2000);
}

// Start initialization immediately and on DOMContentLoaded
init();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
}
