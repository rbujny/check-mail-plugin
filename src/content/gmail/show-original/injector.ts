import { extractOriginalContent } from './extractor';
import { ICON_MARKER, SHIELD_ICON_SVG } from '../icon-injector';
import { optimizeEmailData } from '../../shared/email-data-optimizer';
import { decodeQuotedPrintable } from '../../../utils/sanitizer';
import { extractBodyFromMime } from '../../../utils/mime-parser';
import type { ExtendedEmailData } from '../../../types/email';

/**
 * Finds the native toolbar in the Show Original view.
 * Usually a table cell (.ma a) or immediate container holding download/print buttons.
 */
function findActionRow(): HTMLElement | null {
    // We know we're on Gmail's "Show Original" page (manifest matches view=om).
    // The page structure is always:  heading → metadata table → download link → raw source.
    // The download link points to mail.google.com, while "Learn more" links point to support.google.com.
    // This approach is 100% language-agnostic — no text matching needed.

    const allAnchors = Array.from(document.querySelectorAll('a'));

    // Attempt 1: Find a link that points to mail.google.com but is NOT inside the metadata table.
    // This is always the "Download Original" link regardless of language.
    for (const a of allAnchors) {
        const href = a.getAttribute('href') || '';
        const isGmailLink = href.includes('mail.google.com');
        const isInsideTable = a.closest('table') !== null;

        if (isGmailLink && !isInsideTable) {
            return a.parentElement;
        }
    }

    // Attempt 2: Find any link outside the table that is NOT a support/help link.
    for (const a of allAnchors) {
        const href = a.getAttribute('href') || '';
        const isInsideTable = a.closest('table') !== null;
        const isHelpLink = href.includes('support.google');

        if (!isInsideTable && !isHelpLink && href.length > 0) {
            return a.parentElement;
        }
    }

    // Attempt 3: Last resort — look for table cells with multiple action links
    const tds = document.querySelectorAll<HTMLElement>('table tr td');
    for (const td of tds) {
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
    button.innerHTML = `${SHIELD_ICON_SVG}<span style="margin-left: 6px; font-size: 13px; font-family: Arial, sans-serif;">${chrome.i18n.getMessage("scanButtonText")}</span>`;

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
