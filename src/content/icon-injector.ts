/**
 * Icon injection module for CheckMailPlugin.
 *
 * Responsible for:
 * - Locating expanded email message toolbars in Gmail's DOM
 * - Injecting the CheckMailPlugin shield icon into each toolbar
 * - Cleaning up stale/orphaned/duplicate icons
 * - Handling click events to trigger extraction + logging
 */

import { extractEmailContent } from './email-extractor';
import { optimizeEmailData } from './email-data-optimizer';
import type { ExtendedEmailData } from '../types/email';

/** Marker attribute to identify injected icons */
export const ICON_MARKER = 'data-checkmail-injected';

/** SVG icon inline string (shield with checkmark) */
export const SHIELD_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4" stroke-width="2.5"/></svg>`;

/**
 * Finds all expanded email message containers in the current Gmail view.
 *
 * Gmail structures each message inside elements with role="listitem"
 * or data-message-id attributes. We look for expanded messages that
 * have visible toolbar areas.
 */
function findMessageContainers(): HTMLElement[] {
    const containers: HTMLElement[] = [];

    // Strategy 1: Look for elements with data-message-id (individual messages in a thread)
    const messageElements = document.querySelectorAll<HTMLElement>('[data-message-id]');
    if (messageElements.length > 0) {
        messageElements.forEach((el) => {
            // Only include expanded messages (collapsed ones have minimal height)
            if (el.offsetHeight > 100) {
                containers.push(el);
            }
        });
        return containers;
    }

    // Strategy 2: Look for message containers by structural role
    // Gmail wraps each email in role="listitem" inside the thread view
    const listItems = document.querySelectorAll<HTMLElement>('[role="listitem"]');
    listItems.forEach((item) => {
        // Expanded messages have a body section visible
        const bodySection = item.querySelector('[dir="ltr"], [data-message-id]');
        if (bodySection && item.offsetHeight > 100) {
            containers.push(item);
        }
    });

    // Strategy 3: Fallback — look for the single email view container
    // When viewing a single email (not a thread), look for the main content area
    if (containers.length === 0) {
        const emailView = document.querySelector<HTMLElement>('[role="main"] table[role="presentation"]');
        if (emailView) {
            containers.push(emailView);
        }
    }

    return containers;
}

/**
 * Finds the toolbar area within a message container where we should
 * inject our icon. Looks for the action button row near "Print all"
 * and "Open in new window".
 */
function findToolbar(messageContainer: HTMLElement): HTMLElement | null {
    // Look for toolbar containers with action buttons
    // Gmail action buttons typically live in a td element with specific structure
    const toolbars = messageContainer.querySelectorAll<HTMLElement>('[role="toolbar"], [data-tooltip]');

    // Find the toolbar area that contains print/new-window buttons
    for (const toolbar of toolbars) {
        const parent = toolbar.closest('tr, div');
        if (parent && parent.querySelectorAll('[data-tooltip]').length >= 1) {
            return parent as HTMLElement;
        }
    }

    // Fallback: look for the header area of the message (where sender info and actions are)
    const headerRow = messageContainer.querySelector<HTMLElement>('td.gH, .gH');
    if (headerRow) return headerRow;

    // Last resort: find any container with multiple icon-like buttons
    const actionAreas = messageContainer.querySelectorAll<HTMLElement>('div, td');
    for (const area of actionAreas) {
        const buttons = area.querySelectorAll(':scope > [role="button"], :scope > [data-tooltip], :scope > span[role="button"]');
        if (buttons.length >= 2 && area.offsetWidth > 50) {
            return area;
        }
    }

    return null;
}

/**
 * Creates the CheckMailPlugin icon button element.
 */
function createIconButton(messageContainer: HTMLElement): HTMLButtonElement {
    const button = document.createElement('button');
    button.setAttribute(ICON_MARKER, 'true');
    button.setAttribute('title', 'Scan with CheckMail');
    button.setAttribute('aria-label', 'Scan with CheckMail');
    button.innerHTML = SHIELD_ICON_SVG;

    // Style to match Gmail's native toolbar buttons
    Object.assign(button.style, {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
        margin: '0 2px',
        borderRadius: '4px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        opacity: '0.7',
        transition: 'opacity 0.2s ease, background-color 0.2s ease',
        color: '#5f6368',
        minWidth: '20px',
        minHeight: '20px',
    });

    // Hover effect
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

    // Click handler — extraction + logging
    button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (button.dataset.extracting) return; // Debounce lock

        // Visual feedback: extracting state (FR-006)
        button.dataset.extracting = 'true';
        button.style.opacity = '1';
        button.style.color = '#1a73e8';

        try {
            const result = extractEmailContent(messageContainer);

            // Build optimized payload through the data optimizer
            let rawHeaders: Record<string, string | string[]> = {};
            if ('headers' in result.data) {
                rawHeaders = (result.data as ExtendedEmailData).headers;
            } else {
                // Simplified view: construct headers from parsed fields
                rawHeaders = {
                    'From': result.data.from,
                    'To': result.data.to.join(', '),
                    'Subject': result.data.subject,
                    'Date': result.data.date
                };
            }

            const rawBody = result.data.bodyText;
            const payload = optimizeEmailData(rawHeaders, rawBody);

            if (result.success) {
                chrome.runtime.sendMessage({ type: 'PROCESS_EMAIL', payload });
            } else {
                console.warn('[CheckMailPlugin] Extraction completed with warnings', result.warnings);
                chrome.runtime.sendMessage({ type: 'PROCESS_EMAIL', payload });
            }


            // Visual feedback: success
            button.style.color = '#34a853';
            setTimeout(() => {
                button.style.color = '#5f6368';
                button.style.opacity = '0.7';
                delete button.dataset.extracting;
            }, 1500);
        } catch (error) {
            // Visual feedback: error
            button.style.color = '#ea4335';
            console.error('[CheckMailPlugin] Extraction failed:', error);
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
 * Injects CheckMailPlugin icons into all visible expanded message toolbars.
 * Skips messages that already have an injected icon.
 */
export function injectIcons(): void {
    const containers = findMessageContainers();

    for (const container of containers) {
        // Skip if already injected
        if (container.querySelector(`[${ICON_MARKER}]`)) {
            continue;
        }

        const toolbar = findToolbar(container);
        if (toolbar) {
            const iconButton = createIconButton(container);
            toolbar.appendChild(iconButton);
        }
    }
}

/**
 * Removes all injected CheckMailPlugin icons from the page.
 * Called before re-injection to prevent duplicates, and when
 * navigating away from email view (FR-010).
 */
export function cleanupIcons(): void {
    const existingIcons = document.querySelectorAll(`[${ICON_MARKER}]`);
    existingIcons.forEach((icon) => {
        // Verify the icon's parent message container is still in the DOM and expanded
        const messageContainer = icon.closest('[data-message-id], [role="listitem"], [role="main"]');
        if (!messageContainer || (messageContainer as HTMLElement).offsetHeight < 100) {
            icon.remove();
        }
    });
}
