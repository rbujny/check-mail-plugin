/**
 * Yahoo Mail icon injection module for CheckMailPlugin.
 *
 * Responsible for:
 * - Locating the Yahoo Mail toolbar in standard message view
 * - Injecting the CheckMailPlugin shield icon
 * - Providing a floating overlay button on the "View Raw Message" page
 * - Handling click events with debounce lock (FR-007)
 * - Graceful failure on DOM mismatch (silent console error, never breaks native UI)
 */

import { extractYahooEmailContent, extractYahooRawContent } from './yahoo-extractor';
import { ICON_MARKER, SHIELD_ICON_SVG } from '../gmail/icon-injector';
import { optimizeEmailData } from '../shared/email-data-optimizer';
import { extractBodyFromMime } from '../../utils/mime-parser';
import { decodeQuotedPrintable } from '../../utils/sanitizer';
import type { ExtendedEmailData } from '../../types/email';

/** Size threshold for payload warning (5 MB) */
const SIZE_WARNING_THRESHOLD = 5 * 1024 * 1024;

// ─── Standard View ──────────────────────────────────────────────────

/**
 * Finds the Yahoo Mail message toolbar in the standard view.
 * Uses data-test-id attributes for stability.
 * Falls back to semantic DOM scanning if primary selector fails.
 */
function findYahooToolbar(): HTMLElement | null {
    // Primary: Yahoo uses data-test-id for toolbar
    const toolbar =
        document.querySelector<HTMLElement>('[data-test-id="message-toolbar"] [role="toolbar"]') ||
        document.querySelector<HTMLElement>('[role="toolbar"][data-test-id="focus-group"]');

    if (toolbar) return toolbar;

    // Fallback: Look for a container with Reply / Forward buttons
    const buttons = document.querySelectorAll<HTMLElement>('button[data-test-id]');
    for (const btn of buttons) {
        const testId = btn.getAttribute('data-test-id') || '';
        if (testId.includes('reply') || testId.includes('forward')) {
            return btn.parentElement;
        }
    }

    return null;
}

/**
 * Creates the shield button used in the standard Yahoo Mail view.
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

    // Click handler with debounce lock
    button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (button.dataset.extracting) return; // Debounce lock (FR-007)

        button.dataset.extracting = 'true';
        button.style.opacity = '1';
        button.style.color = '#1a73e8';

        try {
            const result = extractYahooEmailContent(document.body);

            // Build header map from simplified data
            const rawHeaders: Record<string, string | string[]> = {
                'From': result.data.from,
                'To': result.data.to.join(', '),
                'Subject': result.data.subject,
                'Date': result.data.date,
            };

            const payload = optimizeEmailData(rawHeaders, result.data.bodyText);

            if (result.warnings.length > 0) {
                console.warn('[CheckMailPlugin][Yahoo] Extraction completed with warnings:', result.warnings);
            }

            chrome.runtime.sendMessage({ type: 'PROCESS_EMAIL', payload });

            button.style.color = '#34a853'; // success
        } catch (error) {
            button.style.color = '#ea4335'; // error
            console.error('[CheckMailPlugin][Yahoo] Extraction failed:', error);
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
 * Inject the shield icon into the Yahoo Mail standard view toolbar.
 * Fails gracefully: logs a silent error if the toolbar is not found.
 */
export function injectYahooStandardIcon(): void {
    // Skip if already injected
    if (document.querySelector(`[${ICON_MARKER}]`)) {
        return;
    }

    try {
        const toolbar = findYahooToolbar();
        if (toolbar) {
            const button = createStandardShieldButton();
            toolbar.appendChild(button);
        } else {
            console.warn('[CheckMailPlugin][Yahoo] Standard view: toolbar not found for injection');
        }
    } catch (error) {
        // Graceful failure: never break the native UI
        console.error('[CheckMailPlugin][Yahoo] Graceful failure during standard injection:', error);
    }
}

// ─── Raw View ("View Raw Message") ──────────────────────────────────

/**
 * Creates a floating overlay button for the raw email view.
 */
function createRawShieldButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.setAttribute(ICON_MARKER, 'true');
    button.setAttribute('title', 'Extract Raw Original');
    button.setAttribute('aria-label', 'Extract Raw Original');
    button.innerHTML = `${SHIELD_ICON_SVG}<span style="margin-left: 6px; font-size: 13px; font-family: Arial, sans-serif;">Scan with CheckMail</span>`;

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

    // Click handler with debounce lock
    button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (button.dataset.extracting) return; // Debounce lock (FR-007)

        button.dataset.extracting = 'true';
        button.style.background = '#ffa000';

        try {
            const rawText = extractYahooRawContent();

            // 5 MB threshold warning
            const rawSize = new Blob([rawText]).size;
            if (rawSize > SIZE_WARNING_THRESHOLD) {
                console.warn(
                    `[CheckMailPlugin][Yahoo] Raw payload is large (${(rawSize / 1024 / 1024).toFixed(2)} MB). Processing may be slow.`,
                );
            }

            // Extract body from MIME and decode
            const extractedPart = extractBodyFromMime(rawText);
            const decodedBody = decodeQuotedPrintable(extractedPart);

            // Build rudimentary raw headers from full payload
            const rawHeaders: Record<string, string | string[]> = {};
            const headerEndIndex = rawText.indexOf('\r\n\r\n') !== -1
                ? rawText.indexOf('\r\n\r\n')
                : rawText.indexOf('\n\n');

            if (headerEndIndex > 0) {
                const headerBlock = rawText.substring(0, headerEndIndex);
                // Unfold multi-line headers before parsing
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
            console.error('[CheckMailPlugin][Yahoo] Raw extraction failed:', error);
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
 * Inject a floating extraction button in the Yahoo "View Raw Message" page.
 * Fails gracefully: logs a silent error if injection fails.
 */
export function injectYahooRawIcon(): void {
    // Skip if already injected
    if (document.querySelector(`[${ICON_MARKER}]`)) {
        return;
    }

    try {
        const button = createRawShieldButton();
        document.body.appendChild(button);
    } catch (error) {
        // Graceful failure: never break the native UI
        console.error('[CheckMailPlugin][Yahoo] Graceful failure during raw view injection:', error);
    }
}
