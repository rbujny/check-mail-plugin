import { ICON_MARKER, SHIELD_ICON_SVG } from '../gmail/icon-injector';
import { extractProtonEmailContent, extractProtonRawContent } from './proton-extractor';
import { optimizeEmailData } from '../shared/email-data-optimizer';

/** Size threshold for payload warning (5 MB) */
const SIZE_WARNING_THRESHOLD = 5 * 1024 * 1024;

/**
 * Finds all message containers in the ProtonMail view.
 * Usually [data-testid="message-view"] for the expanded message.
 */
export function findProtonMessageContainers(): HTMLElement[] {
    const containers: HTMLElement[] = [];
    const messageViews = document.querySelectorAll<HTMLElement>('[data-testid^="message-view"]');
    
    messageViews.forEach(view => {
        // High height usually means it's expanded and visible
        if (view.offsetHeight > 50) {
            containers.push(view);
        }
    });

    return containers;
}

/**
 * Finds the toolbar within a ProtonMail message container.
 */
export function findProtonToolbar(container: HTMLElement): HTMLElement | null {
    // Strategy 1: Look for the message header expanded toolbar
    const toolbar = container.querySelector<HTMLElement>('.message-view-header, [data-testid="message-header-expanded"]');
    if (toolbar) {
        // Find the action buttons group
        const actionGroup = toolbar.querySelector('.flex-nowrap, .button-group');
        if (actionGroup) return actionGroup as HTMLElement;
        return toolbar;
    }

    // Strategy 2: Look for elements near the Reply button by data-testid
    const replyButton = container.querySelector('[data-testid$=":reply"], [data-testid="message-header-reply"]');
    if (replyButton) {
        // The parent or a sibling group is usually the flex group we want
        const group = replyButton.closest('.button-group, .flex-nowrap');
        return (group as HTMLElement) || replyButton.parentElement;
    }

    return null;
}

/**
 * Creates the CheckMail icon button for ProtonMail.
 */
function createProtonIconButton(container: HTMLElement, isRaw: boolean = false): HTMLButtonElement {
    const button = document.createElement('button');
    button.setAttribute(ICON_MARKER, 'true');
    button.setAttribute('title', 'Scan with CheckMail');
    button.className = 'button button-ghost button-medium button-icon'; // ProtonMail style
    button.innerHTML = SHIELD_ICON_SVG;
    
    // Style to match ProtonMail's native toolbar buttons
    Object.assign(button.style, {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
        margin: '0 4px',
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        transition: 'background-color 0.2s ease, transform 0.2s ease',
        color: '#5f6368', // Standard gray for icons
        minWidth: '32px',
        minHeight: '32px',
        zIndex: '10'
    });

    // Hover effect
    button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = 'rgba(0, 0, 0, 0.08)';
        button.style.transform = 'scale(1.1)';
    });
    button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = 'transparent';
        button.style.transform = 'scale(1)';
    });

    button.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (button.dataset.extracting) return;
        button.dataset.extracting = 'true';
        button.style.color = '#1a73e8';

        try {
            let payload;
            if (isRaw) {
                const rawContent = extractProtonRawContent();

                // 5 MB threshold warning (FR-008)
                const rawSize = new Blob([rawContent]).size;
                if (rawSize > SIZE_WARNING_THRESHOLD) {
                    console.warn(
                        `[CheckMailPlugin][Proton] Raw payload is large (${(rawSize / 1024 / 1024).toFixed(2)} MB). Processing may be slow.`,
                    );
                }

                payload = optimizeEmailData({}, rawContent);
            } else {
                const result = extractProtonEmailContent(container);
                const rawHeaders = {
                    'From': result.data.from,
                    'To': result.data.to.join(', '),
                    'Subject': result.data.subject,
                    'Date': result.data.date
                };
                payload = optimizeEmailData(rawHeaders, result.data.bodyText);
            }

            chrome.runtime.sendMessage({ type: 'PROCESS_EMAIL', payload });
            
            button.style.color = '#34a853';
            setTimeout(() => {
                button.style.color = '#5f6368';
                delete button.dataset.extracting;
            }, 1500);
        } catch (err) {
            console.error('[CheckMailPlugin] Proton extraction failed:', err);
            button.style.color = '#ea4335';
            setTimeout(() => {
                button.style.color = '#5f6368';
                delete button.dataset.extracting;
            }, 1500);
        }
    });

    return button;
}

/**
 * Injects the icon into ProtonMail message views with retry logic.
 */
export async function injectProtonIcons(): Promise<void> {
    console.log('[CheckMailPlugin] Running injectProtonIcons...');
    
    // Standard view injection
    const containers = findProtonMessageContainers();
    console.log(`[CheckMailPlugin] Found ${containers.length} message containers`);
    
    for (const container of containers) {
        if (container.querySelector(`[${ICON_MARKER}]`)) {
            console.log('[CheckMailPlugin] Icon already present in this container, skipping.');
            continue;
        }

        const toolbar = findProtonToolbar(container);
        if (toolbar) {
            console.log('[CheckMailPlugin] Found toolbar, injecting icon...');
            const iconBtn = createProtonIconButton(container);
            
            // Try to prepend to make it more visible (before Reply)
            const replyBtn = toolbar.querySelector('[data-testid$=":reply"]');
            if (replyBtn) {
                replyBtn.before(iconBtn);
            } else {
                toolbar.appendChild(iconBtn);
            }
            console.log('[CheckMailPlugin] Icon injected successfully into message toolbar.');
        } else {
            console.warn('[CheckMailPlugin] Could not find toolbar for message container:', container);
        }
    }

    // Modal view injection
    injectProtonRawIcon();
}

/**
 * Injects the icon into the "Show headers" modal if present.
 */
function injectProtonRawIcon(): void {
    const modal = document.querySelector('.modal-two, [role="dialog"], [data-testid="modal:dialog"]');
    if (modal && !modal.querySelector(`[${ICON_MARKER}]`)) {
        const title = modal.querySelector('h1, h2, [id^="modal-"]');
        const titleText = title?.textContent || '';
        console.log(`[CheckMailPlugin] Inspecting modal title: "${titleText}"`);
        
        if (titleText.includes('Message headers') || titleText.includes('Nagłówki')) {
            console.log('[CheckMailPlugin] Found Message headers modal, attempting injection...');
            // In the live version, it's .modal-two-header (a div)
            const header = modal.querySelector('header, .modal-header, .modal-two-header');
            if (header) {
                const closeBtn = header.querySelector('[data-testid="modal:close"], [data-testid="modal-close"], .modal-close');
                if (closeBtn) {
                    const iconBtn = createProtonIconButton(modal as HTMLElement, true);
                    closeBtn.before(iconBtn);
                    console.log('[CheckMailPlugin] Icon injected into headers modal successfully.');
                } else {
                    console.warn('[CheckMailPlugin] Found headers modal but no close button for injection anchor.');
                }
            } else {
                console.warn('[CheckMailPlugin] Found headers modal but no header element for injection anchor.');
            }
        }
    }
}
