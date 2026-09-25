
import { extractOnetEmailContent, extractOnetRawContent } from './onet-extractor';
import { ICON_MARKER, SHIELD_ICON_SVG } from '../gmail/icon-injector';
import { optimizeEmailData } from '../shared/email-data-optimizer';
import { extractDecodedBody } from '../../utils/mime-parser';

const SIZE_WARNING_THRESHOLD = 5 * 1024 * 1024;

function findOnetToolbars(): Array<{ element: HTMLElement; isActive: boolean }> {
    const toolbars = document.querySelectorAll<HTMLElement>('[role="toolbar"]');
    const results: Array<{ element: HTMLElement; isActive: boolean }> = [];

    for (const toolbar of toolbars) {
        const hasOdpisz = Array.from(toolbar.querySelectorAll('button')).some((btn) => {
            const text = btn.textContent?.trim().toLowerCase() || '';
            return text === 'odpisz' || text === 'odpowiedz';
        });

        const innerWrapper = toolbar.querySelector<HTMLElement>(':scope > div');
        const target = innerWrapper || toolbar;

        if (hasOdpisz) {
            results.unshift({ element: target, isActive: true });
        } else {
            results.push({ element: target, isActive: false });
        }
    }

    if (results.length === 0) {
        const buttons = document.querySelectorAll<HTMLElement>('button');
        for (const btn of buttons) {
            const text = btn.textContent?.trim().toLowerCase() || '';
            if (text === 'odpowiedz' || text === 'odpisz' || text === 'przekaż') {
                if (btn.parentElement) {
                    results.push({ element: btn.parentElement, isActive: true });
                    break;
                }
            }
        }
    }

    return results;
}

export function injectOnetStandardIcon(): void {
    try {
        const toolbars = findOnetToolbars();

        for (const { element: toolbar, isActive } of toolbars) {
            if (toolbar.querySelector(`[${ICON_MARKER}="true"]`)) {
                continue;
            }

            const button = createStandardShieldButton(isActive);
            toolbar.appendChild(button);
        }
    } catch (error) {
        console.error('[CheckMailPlugin][Onet] Graceful failure during standard injection:', error);
    }
}
function createStandardShieldButton(isActive: boolean): HTMLButtonElement {
    const button = document.createElement('button');
    button.setAttribute(ICON_MARKER, 'true');
    button.setAttribute('title', isActive ? chrome.i18n.getMessage("scanButtonText") : 'Select an email to scan');
    if (!isActive) button.setAttribute('disabled', 'true');
    button.setAttribute('aria-label', chrome.i18n.getMessage("scanButtonText"));
    button.innerHTML = SHIELD_ICON_SVG;

    Object.assign(button.style, {
        background: 'none',
        border: 'none',
        cursor: isActive ? 'pointer' : 'default',
        padding: '6px 8px',
        margin: '0 4px',
        borderRadius: '4px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        opacity: isActive ? '0.7' : '0.3',
        transition: 'opacity 0.2s ease, background-color 0.2s ease',
        color: '#5f6368',
        minWidth: '24px',
        minHeight: '24px',
    });

    button.addEventListener('mouseenter', () => {
        if (!isActive) return;
        button.style.opacity = '1';
        button.style.backgroundColor = 'rgba(0, 0, 0, 0.06)';
    });

    button.addEventListener('mouseleave', () => {
        if (!isActive) return;
        if (!button.dataset.extracting) {
            button.style.opacity = '0.7';
            button.style.backgroundColor = 'transparent';
        }
    });

    button.addEventListener('click', async (e) => {
        if (!isActive) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        e.preventDefault();
        e.stopPropagation();

        if (button.dataset.extracting) return;

        button.dataset.extracting = 'true';
        button.style.opacity = '1';
        button.style.color = '#1a73e8';

        try {
            const result = extractOnetEmailContent(document.body);

            const rawHeaders: Record<string, string | string[]> = {
                'From': result.data.from,
                'To': result.data.to.join(', '),
                'Subject': result.data.subject,
                'Date': result.data.date,
            };

            const payload = optimizeEmailData(rawHeaders, result.data.bodyText);

            if (result.warnings.length > 0) {
                console.warn('[CheckMailPlugin][Onet] Extraction completed with warnings:', result.warnings);
            }

            chrome.runtime.sendMessage({ type: 'PROCESS_EMAIL', payload });

            button.style.color = '#34a853';
        } catch (error) {
            button.style.color = '#ea4335';
            console.error('[CheckMailPlugin][Onet] Extraction failed:', error);
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

function findHeadersModal(): HTMLElement | null {
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
    for (const dialog of dialogs) {
        if (
            dialog.textContent?.includes('Nagłówki wiadomości') &&
            dialog.textContent?.includes('Skopiuj do schowka')
        ) {
            return dialog;
        }
    }
    return null;
}

function createModalShieldButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.setAttribute(ICON_MARKER, 'raw');
    button.setAttribute('title', chrome.i18n.getMessage("scanButtonText"));
    button.setAttribute('aria-label', chrome.i18n.getMessage("scanButtonText"));

    button.innerHTML = `
        <span style="display: flex; align-items: center; justify-content: center; width: 18px; height: 18px;">
            ${SHIELD_ICON_SVG}
        </span>
        <span>${chrome.i18n.getMessage("scanButtonText")}</span>
    `;

    Object.assign(button.style, {
        background: 'transparent',
        color: '#5f6368',
        border: '1px solid transparent',
        cursor: 'pointer',
        padding: '0 16px',
        height: '36px',
        borderRadius: '4px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontWeight: '500',
        fontSize: '14px',
        fontFamily: 'inherit',
        opacity: '0.9',
        transition: 'background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease',
    });

    button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
        button.style.color = '#202124';
        button.style.borderColor = '#dadce0';
    });

    button.addEventListener('mouseleave', () => {
        if (!button.dataset.extracting) {
            button.style.backgroundColor = 'transparent';
            button.style.color = '#5f6368';
            button.style.borderColor = 'transparent';
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
            const rawText = extractOnetRawContent();

            if (!rawText || rawText.length < 50) {
                throw new Error('No raw header content found in modal');
            }

            const rawSize = new Blob([rawText]).size;
            if (rawSize > SIZE_WARNING_THRESHOLD) {
                console.warn(
                    `[CheckMailPlugin][Onet] Raw payload is large (${(rawSize / 1024 / 1024).toFixed(2)} MB). Processing may be slow.`,
                );
            }

            const rawHeaders: Record<string, string | string[]> = {};
            const lines = rawText.split('\n');
            let currentKey = '';
            let currentValue = '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                const colonMatch = trimmed.match(/^([A-Za-z][A-Za-z0-9-]*)\s*:\s*(.*)/);
                if (colonMatch) {
                    if (currentKey) {
                        if (rawHeaders[currentKey]) {
                            const existing = rawHeaders[currentKey];
                            if (Array.isArray(existing)) {
                                existing.push(currentValue);
                            } else {
                                rawHeaders[currentKey] = [existing, currentValue];
                            }
                        } else {
                            rawHeaders[currentKey] = currentValue;
                        }
                    }
                    currentKey = colonMatch[1];
                    currentValue = colonMatch[2];
                } else if (currentKey) {
                    currentValue += ' ' + trimmed;
                }
            }
            if (currentKey) {
                if (rawHeaders[currentKey]) {
                    const existing = rawHeaders[currentKey];
                    if (Array.isArray(existing)) {
                        existing.push(currentValue);
                    } else {
                        rawHeaders[currentKey] = [existing, currentValue];
                    }
                } else {
                    rawHeaders[currentKey] = currentValue;
                }
            }

            let decodedBody = '';
            if (rawText.includes('Content-Type:') && rawText.includes('boundary=') && rawText.includes('\n\n')) {
                decodedBody = extractDecodedBody(rawText);
            }

            if (!decodedBody || decodedBody.length < 20) {
                const standardResult = extractOnetEmailContent(document.body);
                decodedBody = standardResult.data.bodyText;
            }

            const payload = optimizeEmailData(rawHeaders, decodedBody);
            chrome.runtime.sendMessage({ type: 'PROCESS_EMAIL', payload });

            button.style.color = '#34a853';
        } catch (error) {
            button.style.color = '#ea4335';
            console.error('[CheckMailPlugin][Onet] Raw extraction failed:', error);
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

export function injectOnetHeadersModalIcon(): void {
    const modal = findHeadersModal();

    if (!modal) {
        const existing = document.querySelector(`[${ICON_MARKER}="raw"]`);
        if (existing) existing.remove();
        return;
    }

    if (modal.querySelector(`[${ICON_MARKER}="raw"]`)) {
        return;
    }

    try {
        const button = createModalShieldButton();

        const allSpans = modal.querySelectorAll('span');
        let copyBtnSpan: HTMLElement | null = null;
        for (const span of allSpans) {
            if (span.textContent?.includes('Skopiuj do schowka')) {
                copyBtnSpan = span;
                break;
            }
        }

        let bottomContainer: HTMLElement | null = null;
        let insertBeforeNode: HTMLElement | null = null;

        if (copyBtnSpan) {
            const copyBtn = copyBtnSpan.closest('button');
            if (copyBtn) {
                let current = copyBtn.parentElement;
                while (current && current !== modal) {
                    if (current.querySelectorAll('button').length >= 2) {
                        bottomContainer = current;

                        let child: HTMLElement | null = copyBtn;
                        while (child && child.parentElement !== bottomContainer) {
                            child = child.parentElement;
                        }
                        insertBeforeNode = child;
                        break;
                    }
                    current = current.parentElement;
                }
            }
        }

        if (bottomContainer && insertBeforeNode) {
            const wrapper = document.createElement('div');
            Object.assign(wrapper.style, {
                display: 'flex',
                alignItems: 'center',
                marginRight: 'auto',
                padding: '0 8px',
            });
            wrapper.appendChild(button);

            bottomContainer.insertBefore(wrapper, insertBeforeNode);
            return;
        }

        const allCloseButtons = modal.querySelectorAll<HTMLElement>('button[title="Zamknij"]');
        let topCloseBtn: HTMLElement | null = null;
        for (const btn of allCloseButtons) {
            if (btn.querySelector('i')) {
                topCloseBtn = btn;
                break;
            }
        }

        if (topCloseBtn && topCloseBtn.parentElement) {
            topCloseBtn.parentElement.insertBefore(button, topCloseBtn);
            return;
        }

        Object.assign(button.style, {
            position: 'absolute',
            top: '6px',
            right: '48px',
        });
        const modalStyle = window.getComputedStyle(modal);
        if (modalStyle.position === 'static') {
            (modal as HTMLElement).style.position = 'relative';
        }
        modal.appendChild(button);
    } catch (error) {
        console.error('[CheckMailPlugin][Onet] Graceful failure during modal injection:', error);
    }
}

export function injectOnetRawIcon(): void {
    if (document.querySelector(`[${ICON_MARKER}="raw"]`)) {
        return;
    }

    try {
        const button = createModalShieldButton();
        Object.assign(button.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
        });
        document.body.appendChild(button);
    } catch (error) {
        console.error('[CheckMailPlugin][Onet] Graceful failure during raw view injection:', error);
    }
}
