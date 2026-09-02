
import { extractInteriaEmailContent, extractInteriaRawContent, extractInteriaDetailsTable } from './interia-extractor';
import { ICON_MARKER, SHIELD_ICON_SVG } from '../gmail/icon-injector';
import { optimizeEmailData } from '../shared/email-data-optimizer';
import { extractBodyFromMime } from '../../utils/mime-parser';
import { decodeQuotedPrintable } from '../../utils/sanitizer';

const SIZE_WARNING_THRESHOLD = 5 * 1024 * 1024;

function findInteriaToolbars(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('ul.message__toolbar__actions'));
}

function createStandardShieldButton(): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'message__toolbar__actions__item';
    li.setAttribute(ICON_MARKER, 'wrapper');
    li.style.display = 'inline-flex';
    li.style.alignItems = 'center';
    li.style.marginRight = '8px';

    const button = document.createElement('button');
    button.setAttribute(ICON_MARKER, 'true');
    button.setAttribute('title', chrome.i18n.getMessage("scanButtonText"));
    button.setAttribute('aria-label', chrome.i18n.getMessage("scanButtonText"));
    
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

    button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (button.dataset.extracting) return;

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

            const detailsTable = extractInteriaDetailsTable();
            if (detailsTable) {
                if (detailsTable['X-Envelope-From']) {
                    rawHeaders['Return-Path'] = detailsTable['X-Envelope-From'];
                }
                if (detailsTable['Reply-To']) {
                    rawHeaders['Reply-To'] = detailsTable['Reply-To'];
                }
            }

            const payload = optimizeEmailData(rawHeaders, result.data.bodyText);

            if (result.warnings.length > 0) {
                console.warn('[CheckMailPlugin][Interia] Extraction completed with warnings:', result.warnings);
            }

            chrome.runtime.sendMessage({ type: 'PROCESS_EMAIL', payload });

            button.style.color = '#34a853';
        } catch (error) {
            button.style.color = '#ea4335';
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

export function injectInteriaStandardIcon(): void {
    try {
        const toolbars = findInteriaToolbars();
        
        for (const toolbar of toolbars) {
            if (toolbar.querySelector(`[${ICON_MARKER}]`)) {
                continue;
            }
            
            const liBlock = createStandardShieldButton();
            
            let starLi: HTMLElement | null = null;
            for (const child of Array.from(toolbar.children)) {
               if (child.querySelector('.icon-star')) {
                   starLi = child as HTMLElement;
                   break;
               }
            }
            
            toolbar.insertBefore(liBlock, starLi || toolbar.firstChild);
        }
    } catch (error) {
        console.error('[CheckMailPlugin][Interia] Graceful failure during standard injection:', error);
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
            const rawText = extractInteriaRawContent();

            const rawSize = new Blob([rawText]).size;
            if (rawSize > SIZE_WARNING_THRESHOLD) {
                console.warn(
                    `[CheckMailPlugin][Interia] Raw payload is large (${(rawSize / 1024 / 1024).toFixed(2)} MB). Processing may be slow.`,
                );
            }

            const extractedPart = extractBodyFromMime(rawText);
            const decodedBody = decodeQuotedPrintable(extractedPart);

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
