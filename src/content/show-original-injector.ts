import { extractOriginalContent } from './show-original-extractor';
import { ICON_MARKER, SHIELD_ICON_SVG } from './icon-injector';
import { optimizeEmailData } from './email-data-optimizer';
import { decodeQuotedPrintable } from '../utils/sanitizer';
import { extractBodyFromMime } from '../utils/mime-parser';
import type { ExtendedEmailData } from '../types/email';

/**
 * Finds the native toolbar in the Show Original view.
 * Usually a table cell (.ma a) or immediate container holding download/print buttons.
 */
function findActionRow(): HTMLElement | null {
    // Attempt 1: Look for container where 'Download Original' resides
    const downloadBtns = Array.from(document.querySelectorAll('a')).filter(a =>
        a.textContent?.toLowerCase().includes('download original')
    );

    if (downloadBtns.length > 0) {
        return downloadBtns[0].parentElement;
    }

    // Attempt 2: General action rows in the header area
    const tables = document.querySelectorAll<HTMLElement>('table.message tr td');
    for (const td of tables) {
        const links = td.querySelectorAll('a');
        if (links.length > 2) {
            return td;
        }
    }

    return null;
}

/**
 * Attaches the shield to the top bar on the Show Original page.
 */
function createShieldButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.setAttribute(ICON_MARKER, 'true');
    button.setAttribute('title', 'Extract Raw Original');
    button.setAttribute('aria-label', 'Extract Raw Original');
    button.innerHTML = `${SHIELD_ICON_SVG}<span style="margin-left: 6px; font-size: 13px; font-family: Arial, sans-serif;">Scan with CheckMail</span>`;

    // Apply raw view specific styling (similar to standard links inside the action row)
    Object.assign(button.style, {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '0 8px',
        margin: '0',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#222', // Typical link color in original view
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

    // Handle extraction
    button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (button.dataset.extracting) return; // Debounce lock

        button.dataset.extracting = 'true';
        button.style.color = '#1a73e8';

        try {
            const result = extractOriginalContent();

            // Allow synchronous thread offloading visual feedback
            await new Promise(resolve => setTimeout(resolve, 0));

            // Build optimized payload through the data optimizer
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

            // Extract the core HTML or Plain text part, discarding MIME boundary wrappers
            const extractedPart = extractBodyFromMime(rawBody);

            // Decode Quoted-Printable format natively
            const decodedBody = decodeQuotedPrintable(extractedPart);

            const payload = optimizeEmailData(rawHeaders, decodedBody);

            chrome.runtime.sendMessage({ type: 'PROCESS_EMAIL', payload });

            button.style.color = '#34a853'; // success
        } catch (error) {
            // Unhandled fallbacks
            button.style.color = '#ea4335'; // error
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
        return; // Already injected
    }

    const actionRow = findActionRow();
    if (actionRow) {
        const button = createShieldButton();
        actionRow.appendChild(document.createTextNode(' | ')); // standard separator
        actionRow.appendChild(button);
    } else {
        console.warn('[CheckMailPlugin] Original View: Action row not found for injection');
    }
}
