
export interface ScanResultPayload {
    result: 'OK' | 'WARNING' | 'PHISHING' | string;
    comment: string;
}

const UI_CONTAINER_ID = 'checkmail-result-container';

const ICONS = {
    OK: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 12l2 2 4-4"></path></svg>`,
    WARNING: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    PHISHING: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
};

const THEMES = {
    OK: {
        bg: '#ecfdf5',
        border: '#10b981',
        textTitle: '#065f46',
        textComment: '#047857',
        iconColor: '#10b981',
        titleKey: 'tierOkTitle'
    },
    WARNING: {
        bg: '#fffbeb',
        border: '#f59e0b',
        textTitle: '#92400e',
        textComment: '#b45309',
        iconColor: '#f59e0b',
        titleKey: 'tierWarningTitle'
    },
    PHISHING: {
        bg: '#fef2f2',
        border: '#ef4444',
        textTitle: '#991b1b',
        textComment: '#b91c1c',
        iconColor: '#ef4444',
        titleKey: 'tierPhishingTitle'
    }
};

function injectStyles(result: 'OK' | 'WARNING' | 'PHISHING'): string {
    const isModal = result === 'PHISHING';

    return `
        <style>
            :host {
                all: initial;
            }
            .wrapper {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                z-index: 2147483647;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                pointer-events: none;
            }
            .backdrop {
                display: none;
            }
            .card {
                background: #ffffff;
                box-shadow: ${isModal ? '0 0 0 4px rgba(239, 68, 68, 0.2), 0 25px 50px -12px rgba(239, 68, 68, 0.35)' : '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'};
                border-radius: 12px;
                border-left: ${isModal ? '10px' : '6px'} solid var(--theme-border);
                overflow: hidden;
                pointer-events: auto;
                display: flex;
                flex-direction: ${isModal ? 'column' : 'row'};
                align-items: ${isModal ? 'flex-start' : 'center'};
                /* Positioning logic */
                position: absolute;
                top: ${isModal ? '50%' : 'auto'};
                left: ${isModal ? '50%' : 'auto'};
                bottom: ${isModal ? 'auto' : '24px'};
                right: ${isModal ? 'auto' : '24px'};
                transform: ${isModal ? 'translate(-50%, -50%) scale(0.95)' : 'translateX(100%)'};
                width: ${isModal ? '480px' : '360px'};
                max-width: calc(100vw - 32px);
                animation: ${isModal ? 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' : 'slideIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'};
            }
            .card.dismissing {
                animation: ${isModal ? 'popOut 0.2s ease-in forwards' : 'slideOut 0.3s ease-in forwards'};
            }
            .header-bar {
                display: flex;
                align-items: ${isModal ? 'center' : 'flex-start'};
                padding: ${isModal ? '20px 24px 12px 24px' : '16px'};
                background: var(--theme-bg);
                width: 100%;
                box-sizing: border-box;
            }
            .icon-box {
                color: var(--theme-icon);
                margin-right: 16px;
                flex-shrink: 0;
                display: flex;
                animation: ${isModal ? 'alertPulse 2s infinite ease-in-out' : 'none'};
            }
            .content-box {
                flex-grow: 1;
            }
            .title {
                font-size: ${isModal ? '20px' : '15px'};
                font-weight: 800;
                color: var(--theme-text-title);
                margin: 0 0 4px 0;
                text-transform: ${isModal ? 'uppercase' : 'none'};
                letter-spacing: ${isModal ? '0.5px' : 'normal'};
            }
            .comment {
                font-size: 14px;
                line-height: 1.5;
                color: var(--theme-text-comment);
                margin: 0;
            }
            .content-wrap {
                padding: ${isModal ? '0 24px 20px 64px' : '0'};
                background: var(--theme-bg);
                width: 100%;
                box-sizing: border-box;
            }
            .actions {
                display: ${isModal ? 'flex' : 'none'};
                justify-content: flex-end;
                padding: 16px 24px;
                background: #f9fafb;
                border-top: 1px solid #e5e7eb;
                width: 100%;
                box-sizing: border-box;
            }
            .btn-primary {
                background: var(--theme-border);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                font-weight: 600;
                font-size: 14px;
                cursor: pointer;
                transition: transform 0.1s, filter 0.2s;
                box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2);
            }
            .btn-primary:hover {
                filter: brightness(1.1);
                transform: translateY(-1px);
            }
            .close-icon {
                display: ${isModal ? 'none' : 'block'};
                background: transparent;
                border: none;
                color: #9ca3af;
                cursor: pointer;
                padding: 8px;
                margin: -8px;
                transition: color 0.2s;
            }
            .close-icon:hover {
                color: #4b5563;
            }

            @keyframes alertPulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.15); filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.6)); }
                100% { transform: scale(1); }
            }
            @keyframes slideIn {
                from { transform: translateX(120%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(120%); opacity: 0; }
            }
            @keyframes popIn {
                from { transform: translate(-50%, -50%) scale(0.9); opacity: 0; }
                to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            }
            @keyframes popOut {
                from { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                to { transform: translate(-50%, -50%) scale(0.9); opacity: 0; }
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        </style>
    `;
}

export function showScanResult(payload: ScanResultPayload): void {
    const tier = THEMES[payload.result as keyof typeof THEMES] ? payload.result : 'WARNING';
    const theme = THEMES[tier as keyof typeof THEMES];
    const iconStr = ICONS[tier as keyof typeof ICONS];

    const existing = document.getElementById(UI_CONTAINER_ID);
    if (existing) existing.remove();

    const hostWrap = document.createElement('div');
    hostWrap.id = UI_CONTAINER_ID;

    const shadow = hostWrap.attachShadow({ mode: 'closed' });

    const rootBlock = document.createElement('div');
    rootBlock.className = 'wrapper';
    rootBlock.style.setProperty('--theme-bg', theme.bg);
    rootBlock.style.setProperty('--theme-border', theme.border);
    rootBlock.style.setProperty('--theme-text-title', theme.textTitle);
    rootBlock.style.setProperty('--theme-text-comment', theme.textComment);
    rootBlock.style.setProperty('--theme-icon', theme.iconColor);

    const isModal = tier === 'PHISHING';

    rootBlock.innerHTML = `
        ${injectStyles(tier as 'OK' | 'WARNING' | 'PHISHING')}
        <div class="backdrop"></div>
        <div class="card" id="result-card">
            <div class="header-bar">
                <div class="icon-box">
                    ${iconStr}
                </div>
                <div class="content-box">
                    <h3 class="title">${chrome.i18n.getMessage(theme.titleKey)}</h3>
                    ${!isModal ? `<p class="comment">${payload.comment}</p>` : ''}
                </div>
                ${!isModal ? `
                <button class="close-icon" id="close-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                ` : ''}
            </div>
            ${isModal ? `
            <div class="content-wrap">
                <p class="comment">${payload.comment}</p>
            </div>
            <div class="actions">
                <button class="btn-primary" id="dismiss-btn">${tier === 'PHISHING' ? chrome.i18n.getMessage('understoodButtonText') : chrome.i18n.getMessage('closeButtonText')}</button>
            </div>
            ` : ''}
        </div>
    `;

    shadow.appendChild(rootBlock);
    document.body.appendChild(hostWrap);

    const card = shadow.querySelector('#result-card') as HTMLElement;
    const backdrop = shadow.querySelector('.backdrop');

    const dismiss = () => {
        if (!card) return;
        card.classList.add('dismissing');
        if (backdrop) {
            (backdrop as HTMLElement).style.animation = 'fadeIn 0.2s ease-in reverse forwards';
        }
        setTimeout(() => hostWrap.remove(), 350);
    };

    if (isModal) {
        const btn = shadow.querySelector('#dismiss-btn');
        if (btn) btn.addEventListener('click', dismiss);
    } else {
        const closeBtn = shadow.querySelector('#close-btn');
        if (closeBtn) closeBtn.addEventListener('click', dismiss);

        if (tier === 'OK') {
            setTimeout(() => {
                if (hostWrap.parentNode) dismiss();
            }, 6000);
        }
    }
}
