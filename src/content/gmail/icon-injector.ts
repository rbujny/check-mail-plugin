
import { extractEmailContent } from './email-extractor';
import { optimizeEmailData } from '../shared/email-data-optimizer';
import type { ExtendedEmailData } from '../../types/email';

export const ICON_MARKER = 'data-checkmail-injected';

export const SHIELD_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4" stroke-width="2.5"/></svg>`;

function findMessageContainers(): HTMLElement[] {
    const containers: HTMLElement[] = [];

    const messageElements = document.querySelectorAll<HTMLElement>('[data-message-id]');
    if (messageElements.length > 0) {
        messageElements.forEach((el) => {
            if (el.offsetHeight > 100) {
                containers.push(el);
            }
        });
        return containers;
    }

    const listItems = document.querySelectorAll<HTMLElement>('[role="listitem"]');
    listItems.forEach((item) => {
        const bodySection = item.querySelector('[dir="ltr"], [data-message-id]');
        if (bodySection && item.offsetHeight > 100) {
            containers.push(item);
        }
    });

    if (containers.length === 0) {
        const emailView = document.querySelector<HTMLElement>('[role="main"] table[role="presentation"]');
        if (emailView) {
            containers.push(emailView);
        }
    }

    return containers;
}

function findToolbar(messageContainer: HTMLElement): HTMLElement | null {
    const toolbars = messageContainer.querySelectorAll<HTMLElement>('[role="toolbar"], [data-tooltip]');

    for (const toolbar of toolbars) {
        const parent = toolbar.closest('tr, div');
        if (parent && parent.querySelectorAll('[data-tooltip]').length >= 1) {
            return parent as HTMLElement;
        }
    }

    const headerRow = messageContainer.querySelector<HTMLElement>('td.gH, .gH');
    if (headerRow) return headerRow;

    const actionAreas = messageContainer.querySelectorAll<HTMLElement>('div, td');
    for (const area of actionAreas) {
        const buttons = area.querySelectorAll(':scope > [role="button"], :scope > [data-tooltip], :scope > span[role="button"]');
        if (buttons.length >= 2 && area.offsetWidth > 50) {
            return area;
        }
    }

    return null;
}

function createIconButton(messageContainer: HTMLElement): HTMLButtonElement {
    const button = document.createElement('button');
    button.setAttribute(ICON_MARKER, 'true');
    button.setAttribute('title', chrome.i18n.getMessage("scanButtonText"));
    button.setAttribute('aria-label', chrome.i18n.getMessage("scanButtonText"));
    button.innerHTML = SHIELD_ICON_SVG;

    Object.assign(button.style, {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
        margin: '0 2px',
        borderRadius: '4px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        opacity: '0.7',
        transition: 'opacity 0.2s ease, background-color 0.2s ease',
        color: '#5f6368',
        minWidth: '20px',
        minHeight: '20px',
    });

    button.addEventListener('mouseenter', () => {
        button.style.opacity = '1';
        button.style.backgroundColor = 'rgba(0, 0, 0, 0.06)';
    });
    button.addEventListener('mouseleave', () => {
        if (!button.dataset.extracting) {
            button.style.opacity = '0.7';
            button.style.backgroundColor = 'transparent';
        }
    });

    button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (button.dataset.extracting) return;

        button.dataset.extracting = 'true';
        button.style.opacity = '1';
        button.style.color = '#1a73e8';

        try {
            const result = extractEmailContent(messageContainer);

            let rawHeaders: Record<string, string | string[]> = {};
            if ('headers' in result.data) {
                rawHeaders = (result.data as ExtendedEmailData).headers;
            } else {
                rawHeaders = {
                    'From': result.data.from,
                    'To': result.data.to.join(', '),
                    'Subject': result.data.subject,
                    'Date': result.data.date
                };
            }

            const rawBody = result.data.bodyText;
            const payload = optimizeEmailData(rawHeaders, rawBody);

            if (result.success) {
                chrome.runtime.sendMessage({ type: 'PROCESS_EMAIL', payload });
            } else {
                console.warn('[CheckMailPlugin] Extraction completed with warnings', result.warnings);
                chrome.runtime.sendMessage({ type: 'PROCESS_EMAIL', payload });
            }

            button.style.color = '#34a853';
            setTimeout(() => {
                button.style.color = '#5f6368';
                button.style.opacity = '0.7';
                delete button.dataset.extracting;
            }, 1500);
        } catch (error) {
            button.style.color = '#ea4335';
            console.error('[CheckMailPlugin] Extraction failed:', error);
            setTimeout(() => {
                button.style.color = '#5f6368';
                button.style.opacity = '0.7';
                delete button.dataset.extracting;
            }, 1500);
        }
    });

    return button;
}

export function injectIcons(): void {
    const containers = findMessageContainers();

    for (const container of containers) {
        if (container.querySelector(`[${ICON_MARKER}]`)) {
            continue;
        }

        const toolbar = findToolbar(container);
        if (toolbar) {
            const iconButton = createIconButton(container);
            toolbar.appendChild(iconButton);
        }
    }
}

export function cleanupIcons(): void {
    const existingIcons = document.querySelectorAll(`[${ICON_MARKER}]`);
    existingIcons.forEach((icon) => {
        const messageContainer = icon.closest('[data-message-id], [role="listitem"], [role="main"]');
        if (!messageContainer || (messageContainer as HTMLElement).offsetHeight < 100) {
            icon.remove();
        }
    });
}
