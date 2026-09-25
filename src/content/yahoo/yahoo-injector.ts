
import { extractYahooEmailContent, extractYahooRawContent } from './yahoo-extractor';
import { ICON_MARKER, SHIELD_ICON_SVG } from '../gmail/icon-injector';
import { optimizeEmailData } from '../shared/email-data-optimizer';
import { extractDecodedBody } from '../../utils/mime-parser';
import type { ExtendedEmailData } from '../../types/email';

const SIZE_WARNING_THRESHOLD = 5 * 1024 * 1024;

function findYahooToolbar(): HTMLElement | null {
    const toolbar = document.querySelector<HTMLElement>('[data-test-id="focus-group"][role="toolbar"]');

    if (toolbar) return toolbar;

    const buttons = document.querySelectorAll<HTMLElement>('button[data-test-id]');
    for (const btn of buttons) {
        const testId = btn.getAttribute('data-test-id') || '';
        if (testId.includes('reply') || testId.includes('forward')) {
            return btn.parentElement;
        }
    }

    return null;
}

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

    button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (button.dataset.extracting) return;

        button.dataset.extracting = 'true';
        button.style.opacity = '1';
        button.style.color = '#1a73e8';

        try {
            const result = extractYahooEmailContent(document.body);

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

            button.style.color = '#34a853';
        } catch (error) {
            button.style.color = '#ea4335';
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

export function injectYahooStandardIcon(): void {
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
        console.error('[CheckMailPlugin][Yahoo] Graceful failure during standard injection:', error);
    }
}

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

    button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (button.dataset.extracting) return;

        button.dataset.extracting = 'true';
        button.style.background = '#ffa000';

        try {
            const rawText = extractYahooRawContent();

            const rawSize = new Blob([rawText]).size;
            if (rawSize > SIZE_WARNING_THRESHOLD) {
                console.warn(
                    `[CheckMailPlugin][Yahoo] Raw payload is large (${(rawSize / 1024 / 1024).toFixed(2)} MB). Processing may be slow.`,
                );
            }

            const decodedBody = extractDecodedBody(rawText);

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

            button.style.background = '#34a853';
        } catch (error) {
            button.style.background = '#ea4335';
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

export function injectYahooRawIcon(): void {
    if (document.querySelector(`[${ICON_MARKER}]`)) {
        return;
    }

    try {
        const button = createRawShieldButton();
        document.body.appendChild(button);
    } catch (error) {
        console.error('[CheckMailPlugin][Yahoo] Graceful failure during raw view injection:', error);
    }
}
