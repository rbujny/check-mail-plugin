/**
 * WP Mail icon injection module for CheckMailPlugin.
 *
 * Responsible for:
 * - Locating the WP Mail toolbar in standard message view
 * - Injecting the CheckMailPlugin shield icon
 * - Providing a floating overlay button on the raw source view
 * - Handling click events with dataset.extracting debounce lock (FR-006)
 * - Brief visual loading state via icon color change (FR-007)
 * - Graceful failure on DOM mismatch (silent console error, never breaks native UI)
 */

import { extractWpEmailContent, extractWpRawContent } from './wp-extractor';
import { ICON_MARKER, SHIELD_ICON_SVG } from '../gmail/icon-injector';
import { optimizeEmailData } from '../shared/email-data-optimizer';
import { extractBodyFromMime } from '../../utils/mime-parser';
import { decodeQuotedPrintable } from '../../utils/sanitizer';

/** Size threshold for payload warning (5 MB) */
const SIZE_WARNING_THRESHOLD = 5 * 1024 * 1024;

// ─── Standard View ──────────────────────────────────────────────────

/**
 * Finds the WP Mail message toolbar in the standard view.
 * Targets WP-specific data attributes with semantic fallbacks.
 */
function findWpToolbar(): HTMLElement | null {
    // Priority: New WP toolbar selector (button parent)
    const wrapKeyBtn = document.querySelector<HTMLElement>('button[data-wrap-key="reply"], button[data-wrap-key="forward"]');
    if (wrapKeyBtn && wrapKeyBtn.parentElement) {
        return wrapKeyBtn.parentElement;
    }

    const toolbar =
        document.querySelector<HTMLElement>('[data-qa="mail-toolbar"]') ||
        document.querySelector<HTMLElement>('[role="toolbar"]') ||
        document.querySelector<HTMLElement>('.mailToolbar');

    if (toolbar) return toolbar;

    // Fallback: Look for Reply/Forward buttons and use their parent
    const buttons = document.querySelectorAll<HTMLElement>('button');
    for (const btn of buttons) {
        const text = btn.textContent?.toLowerCase() || '';
        const qa = btn.getAttribute('data-qa') || '';
        if (text === 'odpowiedz' || text === 'przekaż' || qa.includes('reply') || qa.includes('forward')) {
            return btn.parentElement;
        }
    }

    return null;
}

/**
 * Creates the shield button for the standard WP Mail view.
 */
function createStandardShieldButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.setAttribute(ICON_MARKER, 'true');
    button.setAttribute('title', chrome.i18n.getMessage("scanButtonText"));
    button.setAttribute('aria-label', chrome.i18n.getMessage("scanButtonText"));
    button.innerHTML = SHIELD_ICON_SVG;

    Object.assign(button.style, {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '6px 8px',
        margin: '0 4px',
        borderRadius: '4px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        opacity: '0.7',
        transition: 'opacity 0.2s ease, background-color 0.2s ease',
        color: '#5f6368',
        minWidth: '24px',
        minHeight: '24px',
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

    // Click handler with dataset.extracting debounce lock (FR-006)
    button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (button.dataset.extracting) return; // Debounce lock (FR-006)

        // Brief visual loading state — icon color change (FR-007)
        button.dataset.extracting = 'true';
        button.style.opacity = '1';
        button.style.color = '#1a73e8';

        try {
            const result = extractWpEmailContent(document.body);

            const rawHeaders: Record<string, string | string[]> = {
                'From': result.data.from,
                'To': result.data.to.join(', '),
                'Subject': result.data.subject,
                'Date': result.data.date,
            };

            const payload = optimizeEmailData(rawHeaders, result.data.bodyText);

            if (result.warnings.length > 0) {
                console.warn('[CheckMailPlugin][WP] Extraction completed with warnings:', result.warnings);
            }

            chrome.runtime.sendMessage({ type: 'PROCESS_EMAIL', payload });

            button.style.color = '#34a853'; // success
        } catch (error) {
            button.style.color = '#ea4335'; // error
            console.error('[CheckMailPlugin][WP] Extraction failed:', error);
        } finally {
            setTimeout(() => {
                button.style.color = '#5f6368';
                button.style.opacity = '0.7';
                delete button.dataset.extracting;
            }, 1500);
        }
    });

    return button;
}

/**
 * Inject the shield icon into the WP Mail standard view toolbar.
 * Fails gracefully: logs a silent warning if the toolbar is not found.
 */
export function injectWpStandardIcon(): void {
    if (document.querySelector(`[${ICON_MARKER}]`)) {
        return;
    }

    try {
        const toolbar = findWpToolbar();
        if (toolbar) {
            const button = createStandardShieldButton();
            // Prepend instead of append to prevent the CheckMail button from wrapping 
            // into the hidden overflow area of WP's responsive toolbar.
            toolbar.insertBefore(button, toolbar.firstChild);
        } else {
            console.warn('[CheckMailPlugin][WP] Standard view: toolbar not found for injection');
        }
    } catch (error) {
        console.error('[CheckMailPlugin][WP] Graceful failure during standard injection:', error);
    }
}

// ─── Raw View ("Pokaż źródło") ──────────────────────────────────────

/**
 * Creates a floating overlay button for the raw email source view.
 */
function createRawShieldButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.setAttribute(ICON_MARKER, 'raw'); // Distinct marker for raw view
    button.setAttribute('title', chrome.i18n.getMessage("scanRawButtonTitle") || 'Extract Raw Original');
    button.setAttribute('aria-label', chrome.i18n.getMessage("scanRawButtonTitle") || 'Extract Raw Original');
    button.innerHTML = `
        <span style="display: flex; align-items: center; justify-content: center; width: 18px; height: 18px;">
            ${SHIELD_ICON_SVG.replace('width="20" height="20"', 'width="18" height="18"')}
        </span>
        <span style="font-weight: 500; font-size: 14px;">${chrome.i18n.getMessage("scanButtonText") || 'Scan with CheckMail'}</span>
    `;

    Object.assign(button.style, {
        background: '#ffffff',
        border: '1px solid #c2c9d1',
        cursor: 'pointer',
        padding: '0 16px',
        margin: '0',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        color: '#344050',
        height: '40px', // Match standard WP button height
        borderRadius: '6px',
        fontFamily: 'inherit',
        transition: 'all 0.2s ease',
        flex: '1', // Let it stretch evenly in the footer
    });

    button.addEventListener('mouseenter', () => {
        button.style.background = '#f3f4f6';
        button.style.borderColor = '#9ca3af';
    });

    button.addEventListener('mouseleave', () => {
        if (!button.dataset.extracting) {
            button.style.background = '#ffffff';
            button.style.borderColor = '#c2c9d1';
        }
    });

    // Click handler with dataset.extracting debounce lock (FR-006)
    button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (button.dataset.extracting) return; // Debounce lock (FR-006)

        // Brief visual loading state — icon color change (FR-007)
        button.dataset.extracting = 'true';
        button.style.color = '#1a73e8';
        button.style.borderColor = '#1a73e8';
        button.style.background = '#f0fdf4';

        try {
            const rawText = extractWpRawContent();

            // 5 MB threshold warning
            const rawSize = new Blob([rawText]).size;
            if (rawSize > SIZE_WARNING_THRESHOLD) {
                console.warn(
                    `[CheckMailPlugin][WP] Raw payload is large (${(rawSize / 1024 / 1024).toFixed(2)} MB). Processing may be slow.`,
                );
            }

            const extractedPart = extractBodyFromMime(rawText);
            const decodedBody = decodeQuotedPrintable(extractedPart);

            // Parse raw headers from MIME payload
            const rawHeaders: Record<string, string | string[]> = {};
            const headerEndIndex = rawText.indexOf('\r\n\r\n') !== -1
                ? rawText.indexOf('\r\n\r\n')
                : rawText.indexOf('\n\n');

            if (headerEndIndex > 0) {
                const headerBlock = rawText.substring(0, headerEndIndex);
                const unfolded = headerBlock.replace(/\r?\n[ \t]+/g, ' ');
                const lines = unfolded.split(/\r?\n/);
                for (const line of lines) {
                    const colonIdx = line.indexOf(':');
                    if (colonIdx > 0) {
                        const key = line.substring(0, colonIdx).trim();
                        const value = line.substring(colonIdx + 1).trim();
                        if (rawHeaders[key]) {
                            const existing = rawHeaders[key];
                            if (Array.isArray(existing)) {
                                existing.push(value);
                            } else {
                                rawHeaders[key] = [existing, value];
                            }
                        } else {
                            rawHeaders[key] = value;
                        }
                    }
                }
            }

            const payload = optimizeEmailData(rawHeaders, decodedBody);
            chrome.runtime.sendMessage({ type: 'PROCESS_EMAIL', payload });

            button.style.color = '#34a853'; // success
        } catch (error) {
            button.style.color = '#ea4335'; // error
            console.error('[CheckMailPlugin][WP] Raw extraction failed:', error);
        } finally {
            setTimeout(() => {
                button.style.color = '#344050';
                button.style.borderColor = '#c2c9d1';
                button.style.background = '#ffffff';
                delete button.dataset.extracting;
            }, 1500);
        }
    });

    return button;
}

/**
 * Inject a floating extraction button in the WP raw source view.
 * Fails gracefully: logs a silent error if injection fails.
 */
export function injectWpRawIcon(): void {
    const modalTitle = Array.from(document.querySelectorAll('.modal__title')).find(h => h.textContent?.trim() === 'Źródło wiadomości');
    const legacyPre = document.querySelector('pre');
    const isLegacyRaw = window.location.href.includes('view=source') || (legacyPre && legacyPre.textContent?.includes('Received:'));

    if (!modalTitle && !isLegacyRaw) {
        // Cleanup if modal was closed
        const existing = document.querySelector(`[${ICON_MARKER}="raw"]`);
        if (existing) existing.remove();
        return;
    }

    if (document.querySelector(`[${ICON_MARKER}="raw"]`)) {
        return;
    }

    try {
        const button = createRawShieldButton();

        const modalFooter = modalTitle?.closest('div[role="dialog"], .modal')?.querySelector('.modal-footer, .modal__footer') as HTMLElement;

        if (modalFooter) {
            // Reconfigure the footer layout to place two buttons side-by-side nicely
            modalFooter.style.display = 'flex';
            modalFooter.style.gap = '12px';

            // Wstawiamy nasz przycisk na sam początek (przed Zamknij)
            modalFooter.insertBefore(button, modalFooter.firstChild);
        } else {
            // Legacy fallback if modal footer is missing or full page
            Object.assign(button.style, {
                position: 'fixed',
                top: '20px',
                right: '20px',
                flex: 'none'
            });
            document.body.appendChild(button);
        }
    } catch (error) {
        console.error('[CheckMailPlugin][WP] Graceful failure during raw view injection:', error);
    }
}
