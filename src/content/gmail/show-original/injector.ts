import { extractOriginalContent } from './extractor';
import { ICON_MARKER, SHIELD_ICON_SVG } from '../icon-injector';
import { optimizeEmailData } from '../../shared/email-data-optimizer';
import { extractDecodedBody } from '../../../utils/mime-parser';
import type { ExtendedEmailData } from '../../../types/email';

function findActionRow(): HTMLElement | null {

    const allAnchors = Array.from(document.querySelectorAll('a'));

    for (const a of allAnchors) {
        const href = a.getAttribute('href') || '';
        const isGmailLink = href.includes('mail.google.com');
        const isInsideTable = a.closest('table') !== null;

        if (isGmailLink && !isInsideTable) {
            return a.parentElement;
        }
    }

    for (const a of allAnchors) {
        const href = a.getAttribute('href') || '';
        const isInsideTable = a.closest('table') !== null;
        const isHelpLink = href.includes('support.google');

        if (!isInsideTable && !isHelpLink && href.length > 0) {
            return a.parentElement;
        }
    }

    const tds = document.querySelectorAll<HTMLElement>('table tr td');
    for (const td of tds) {
        const links = td.querySelectorAll('a');
        if (links.length > 2) {
            return td;
        }
    }

    return null;
}

function createShieldButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.setAttribute(ICON_MARKER, 'true');
    button.setAttribute('title', 'Extract Raw Original');
    button.setAttribute('aria-label', 'Extract Raw Original');
    button.innerHTML = `${SHIELD_ICON_SVG}<span style="margin-left: 6px; font-size: 13px; font-family: Arial, sans-serif;">${chrome.i18n.getMessage("scanButtonText")}</span>`;

    Object.assign(button.style, {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '0 8px',
        margin: '0',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#222',
        transition: 'color 0.2s ease',
        verticalAlign: 'middle',
    });

    button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
        button.style.color = '#111';
    });

    button.addEventListener('mouseleave', () => {
        if (!button.dataset.extracting) {
            button.style.backgroundColor = 'transparent';
            button.style.color = '#222';
        }
    });

    button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (button.dataset.extracting) return;

        button.dataset.extracting = 'true';
        button.style.color = '#1a73e8';

        try {
            const result = extractOriginalContent();

            await new Promise(resolve => setTimeout(resolve, 0));

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

            let rawBody = ('rawBody' in result.data)
                ? (result.data as ExtendedEmailData).rawBody
                : result.data.bodyText;

            const decodedBody = extractDecodedBody(rawBody, rawHeaders);

            const payload = optimizeEmailData(rawHeaders, decodedBody);

            chrome.runtime.sendMessage({ type: 'PROCESS_EMAIL', payload });

            button.style.color = '#34a853';
        } catch (error) {
            button.style.color = '#ea4335';
            console.error('[CheckMailPlugin] Raw extraction failed:', error);
        } finally {
            setTimeout(() => {
                button.style.color = '#222';
                delete button.dataset.extracting;
            }, 1500);
        }
    });

    return button;
}

export function injectOriginalIcon(): void {
    if (document.querySelector(`[${ICON_MARKER}]`)) {
        return;
    }

    const actionRow = findActionRow();
    if (actionRow) {
        const button = createShieldButton();
        actionRow.appendChild(document.createTextNode(' | '));
        actionRow.appendChild(button);
    } else {
        console.warn('[CheckMailPlugin] Original View: Action row not found for injection');
    }
}
