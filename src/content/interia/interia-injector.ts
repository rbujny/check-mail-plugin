/**
 * Interia Mail icon injection module for CheckMailPlugin.
 *
 * Responsible for:
 * - Locating the Interia Mail toolbar in standard message view
 * - Injecting the CheckMailPlugin shield icon
 * - Providing a floating overlay button on the raw source view
 * - Handling click events with dataset.extracting debounce lock (FR-006)
 * - Brief visual loading state via icon color change (FR-007)
 * - Graceful failure on DOM mismatch (silent console error, never breaks native UI)
 */

import { extractInteriaEmailContent, extractInteriaRawContent, extractInteriaDetailsTable } from './interia-extractor';
import { ICON_MARKER, SHIELD_ICON_SVG } from '../gmail/icon-injector';
import { optimizeEmailData } from '../shared/email-data-optimizer';
import { extractBodyFromMime } from '../../utils/mime-parser';
import { decodeQuotedPrintable } from '../../utils/sanitizer';

/** Size threshold for payload warning (5 MB) */
const SIZE_WARNING_THRESHOLD = 5 * 1024 * 1024;

// ─── Standard View ──────────────────────────────────────────────────

/**
 * Finds all instances of the Interia Mail message action toolbars.
 * Interia can have standard and sticky toolbars simultaneously.
 */
function findInteriaToolbars(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('ul.message__toolbar__actions'));
}

/**
 * Creates the shield button wrapper for the standard Interia Mail view.
 */
function createStandardShieldButton(): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'message__toolbar__actions__item';
    li.setAttribute(ICON_MARKER, 'wrapper');
    // Ensure inline display so it doesn't break the row and create a column!
    li.style.display = 'inline-flex';
    li.style.alignItems = 'center';
    li.style.marginRight = '8px';

    const button = document.createElement('button');
    button.setAttribute(ICON_MARKER, 'true');
    button.setAttribute('title', chrome.i18n.getMessage("scanButtonText"));
    button.setAttribute('aria-label', chrome.i18n.getMessage("scanButtonText"));
    
    // Add text label and standard text button styling
    button.innerHTML = `
        <span style="display: flex; align-items: center; justify-content: center; width: 16px; height: 16px;">
            ${SHIELD_ICON_SVG}
        </span>
        <span style="font-weight: 500; font-size: 13px;">${chrome.i18n.getMessage("scanButtonText")}</span>
    `;

    Object.assign(button.style, {
        background: 'transparent',
        border: '1px solid #c2c9d1',
        cursor: 'pointer',
        padding: '0 12px',
        margin: '0',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        opacity: '0.85',
        transition: 'all 0.2s ease',
        color: '#344050',
        height: '28px',
        borderRadius: '14px',
        fontFamily: 'inherit',
    });

    button.addEventListener('mouseenter', () => {
        button.style.opacity = '1';
        button.style.background = '#f3f4f6';
        button.style.borderColor = '#9ca3af';
    });

    button.addEventListener('mouseleave', () => {
        if (!button.dataset.extracting) {
            button.style.opacity = '0.85';
            button.style.background = 'transparent';
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
        button.style.opacity = '1';
        button.style.color = '#1a73e8';

        try {
            const result = extractInteriaEmailContent(document.body);

            let rawHeaders: Record<string, string | string[]> = {
                'From': result.data.from,
                'To': result.data.to.join(', '),
                'Subject': result.data.subject,
                'Date': result.data.date,
            };

            // If user opened "Szczegóły wiadomości", extract detailed raw headers
            const detailsTable = extractInteriaDetailsTable();
            if (detailsTable) {
                // Selectively merge headers to avoid replacing clean UI Subject/From 
                // with raw MIME encoded strings
                if (detailsTable['X-Envelope-From']) {
                    rawHeaders['Return-Path'] = detailsTable['X-Envelope-From'];
                }
                if (detailsTable['Reply-To']) {
                    rawHeaders['Reply-To'] = detailsTable['Reply-To'];
                }
                // We do NOT spread all detailsTable headers into rawHeaders
                // because it breaks parsing if it contains MIME encoded subject.
            }

            const payload = optimizeEmailData(rawHeaders, result.data.bodyText);

            if (result.warnings.length > 0) {
                console.warn('[CheckMailPlugin][Interia] Extraction completed with warnings:', result.warnings);
            }

            chrome.runtime.sendMessage({ type: 'PROCESS_EMAIL', payload });

            button.style.color = '#34a853'; // success
        } catch (error) {
            button.style.color = '#ea4335'; // error
            console.error('[CheckMailPlugin][Interia] Extraction failed:', error);
        } finally {
            setTimeout(() => {
                button.style.color = '#5f6368';
                button.style.opacity = '0.7';
                delete button.dataset.extracting;
            }, 1500);
        }
    });

    li.appendChild(button);
    return li;
}

/**
 * Inject the shield icon into the Interia Mail standard view toolbar.
 */
export function injectInteriaStandardIcon(): void {
    try {
        const toolbars = findInteriaToolbars();
        
        for (const toolbar of toolbars) {
            // Already injected in this toolbar?
            if (toolbar.querySelector(`[${ICON_MARKER}]`)) {
                continue;
            }
            
            const liBlock = createStandardShieldButton();
            
            // Try to place it to the left of the star icon (as the first element)
            let starLi: HTMLElement | null = null;
            for (const child of Array.from(toolbar.children)) {
               if (child.querySelector('.icon-star')) {
                   starLi = child as HTMLElement;
                   break;
               }
            }
            
            // Insert as first child or before star
            toolbar.insertBefore(liBlock, starLi || toolbar.firstChild);
        }
    } catch (error) {
        console.error('[CheckMailPlugin][Interia] Graceful failure during standard injection:', error);
    }
}

// ─── Raw View ("Pokaż nagłówki" / "Źródło wiadomości") ─────────────

/**
 * Creates a floating overlay button for the raw email source view.
 */
function createRawShieldButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.setAttribute(ICON_MARKER, 'true');
    button.setAttribute('title', 'Extract Raw Original');
    button.setAttribute('aria-label', 'Extract Raw Original');
    button.innerHTML = `${SHIELD_ICON_SVG}<span style="margin-left: 6px; font-size: 13px; font-family: Arial, sans-serif;">${chrome.i18n.getMessage("scanButtonText")}</span>`;

    Object.assign(button.style, {
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: '999999',
        background: '#1a73e8',
        color: '#ffffff',
        border: 'none',
        cursor: 'pointer',
        padding: '8px 16px',
        borderRadius: '24px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        fontWeight: 'bold',
        transition: 'background 0.2s ease, box-shadow 0.2s ease',
    });

    button.addEventListener('mouseenter', () => {
        button.style.background = '#1765cc';
        button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    });

    button.addEventListener('mouseleave', () => {
        if (!button.dataset.extracting) {
            button.style.background = '#1a73e8';
            button.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.25)';
        }
    });

    // Click handler with dataset.extracting debounce lock (FR-006)
    button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (button.dataset.extracting) return; // Debounce lock (FR-006)

        // Brief visual loading state — icon color change (FR-007)
        button.dataset.extracting = 'true';
        button.style.background = '#ffa000';

        try {
            const rawText = extractInteriaRawContent();

            // 5 MB threshold warning
            const rawSize = new Blob([rawText]).size;
            if (rawSize > SIZE_WARNING_THRESHOLD) {
                console.warn(
                    `[CheckMailPlugin][Interia] Raw payload is large (${(rawSize / 1024 / 1024).toFixed(2)} MB). Processing may be slow.`,
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

            button.style.background = '#34a853'; // success
        } catch (error) {
            button.style.background = '#ea4335'; // error
            console.error('[CheckMailPlugin][Interia] Raw extraction failed:', error);
        } finally {
            setTimeout(() => {
                button.style.background = '#1a73e8';
                delete button.dataset.extracting;
            }, 1500);
        }
    });

    return button;
}

/**
 * Inject a floating extraction button in the Interia raw source view.
 */
export function injectInteriaRawIcon(): void {
    if (document.querySelector(`[${ICON_MARKER}]`)) {
        return;
    }

    try {
        const button = createRawShieldButton();
        document.body.appendChild(button);
    } catch (error) {
        console.error('[CheckMailPlugin][Interia] Graceful failure during raw view injection:', error);
    }
}
