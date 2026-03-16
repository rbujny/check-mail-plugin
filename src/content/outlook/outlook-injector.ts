import { extractOutlookEmailContent, extractOutlookRawContent, parseSMTPHeaders } from './outlook-extractor';
import { ICON_MARKER, SHIELD_ICON_SVG } from '../icon-injector';
import { optimizeEmailData } from '../email-data-optimizer';
import { extractBodyFromMime } from '../../utils/mime-parser';
import { decodeQuotedPrintable } from '../../utils/sanitizer';

/** Size threshold for payload warning (5 MB) */
const SIZE_WARNING_THRESHOLD = 5 * 1024 * 1024;

// --- Standard View ---

/**
 * Finds the Outlook message toolbar.
 */
function findOutlookToolbar(): HTMLElement | null {
    // Look for command bars by role or common test IDs
    const toolbar = document.querySelector<HTMLElement>('[data-testid="CommandBar"]') ||
        document.querySelector<HTMLElement>('[role="toolbar"]') ||
        document.querySelector<HTMLElement>('.ms-CommandBar');

    if (toolbar) return toolbar;

    // Fallback: Look for the Reply icon's button container (language-agnostic)
    const replyIcon = document.querySelector('[data-icon-name="Reply"]') ||
        document.querySelector('[data-icon-name="ReplyAll"]') ||
        document.querySelector('.ms-Icon--Reply');

    return replyIcon?.closest('button')?.parentElement as HTMLElement | null;
}

/**
 * Creates the shield button for standard view.
 */
function createStandardShieldButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.setAttribute(ICON_MARKER, 'true');
    button.setAttribute('title', 'Scan with CheckMail');
    button.setAttribute('aria-label', 'Scan with CheckMail');
    button.innerHTML = SHIELD_ICON_SVG;

    Object.assign(button.style, {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px 8px',
        margin: '0 4px',
        borderRadius: '4px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        opacity: '0.7',
        transition: 'opacity 0.2s ease, background-color 0.2s ease',
        color: '#5f6368',
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
        button.style.color = '#1a73e8';

        try {
            // Scope lookup to the active message container if possible to avoid collisions
            const container = document.querySelector('[role="main"]') as HTMLElement || document.body;
            const result = extractOutlookEmailContent(container);

            const rawHeaders: Record<string, string | string[]> = {
                'From': result.data.from,
                'To': result.data.to,
                'Subject': result.data.subject,
                'Date': result.data.date,
            };

            const payload = optimizeEmailData(rawHeaders, result.data.bodyText);
            chrome.runtime.sendMessage({ type: 'PROCESS_EMAIL', payload });
            button.style.color = '#34a853';
        } catch (error) {
            button.style.color = '#ea4335';
            console.error('[CheckMailPlugin][Outlook] Extraction failed:', error);
        } finally {
            setTimeout(() => {
                button.style.color = '#5f6368';
                delete button.dataset.extracting;
            }, 1500);
        }
    });

    return button;
}

export function injectOutlookStandardIcon(): void {
    if (document.querySelector(`[${ICON_MARKER}="standard"]`)) return;

    try {
        const toolbar = findOutlookToolbar();
        if (toolbar) {
            const button = createStandardShieldButton();
            button.setAttribute(ICON_MARKER, 'standard');
            toolbar.appendChild(button);
        }
    } catch (error) {
        console.error('[CheckMailPlugin][Outlook] Injection failed:', error);
    }
}

// --- Raw View ---

function createRawShieldButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.setAttribute(ICON_MARKER, 'raw');
    button.setAttribute('title', 'Extract Raw Original');
    button.innerHTML = `${SHIELD_ICON_SVG}<span style="margin-left: 8px;">Scan with CheckMail</span>`;

    // Modern Fluent UI Primary/Ghost button hybrid style
    Object.assign(button.style, {
        background: '#ffffff',
        color: '#1a73e8',
        border: '1px solid #d1d1d1',
        cursor: 'pointer',
        padding: '6px 16px',
        borderRadius: '4px',
        display: 'inline-flex',
        alignItems: 'center',
        fontWeight: '600',
        fontSize: '14px',
        marginRight: '12px',
        height: '32px',
        transition: 'all 0.2s ease',
    });

    button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = '#f3f2f1';
        button.style.borderColor = '#8a8886';
    });

    button.addEventListener('mouseleave', () => {
        if (!button.dataset.extracting) {
            button.style.backgroundColor = '#ffffff';
            button.style.borderColor = '#d1d1d1';
        }
    });

    button.addEventListener('click', async () => {
        if (button.dataset.extracting) return;
        button.dataset.extracting = 'true';
        button.style.background = '#ffa000';

        try {
            const rawText = extractOutlookRawContent();
            if (!rawText) throw new Error('No raw text found in dialog');

            const extractedPart = extractBodyFromMime(rawText);
            const decodedBody = decodeQuotedPrintable(extractedPart);

            const rawHeaders = parseSMTPHeaders(rawText);

            const payload = optimizeEmailData(rawHeaders, decodedBody);
            chrome.runtime.sendMessage({ type: 'PROCESS_EMAIL', payload });
            button.style.background = '#34a853';
        } catch (error) {
            button.style.background = '#ea4335';
            console.error('[CheckMailPlugin][Outlook] Raw extraction failed:', error);
        } finally {
            setTimeout(() => {
                button.style.background = '#ffffff';
                delete button.dataset.extracting;
            }, 1500);
        }
    });

    return button;
}

export function injectOutlookRawIcon(): void {
    if (document.querySelector(`[${ICON_MARKER}="raw"]`)) return;

    const dialogs = document.querySelectorAll('[role="dialog"]');
    for (const dialog of Array.from(dialogs)) {
        // Confirm it's the message source dialog
        if (dialog.textContent?.includes('Received:') ||
            dialog.textContent?.includes('Authentication-Results:')) {

            // Find the footer actions container
            // fui-DialogActions is standard Fluent UI 9, ms-Dialog-actions is Fluent UI 8
            const footer = dialog.querySelector('.fui-DialogActions') ||
                dialog.querySelector('.ms-Dialog-actions') ||
                dialog.querySelector('footer') ||
                dialog.querySelector('button:last-child')?.parentElement;

            if (footer) {
                const btn = createRawShieldButton();
                // Prepend so it's to the left of "Close"
                footer.insertBefore(btn, footer.firstChild);
            }
            return;
        }
    }
}
