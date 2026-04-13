import type { EmailData, ExtractionResult } from '../../types/email';

/**
 * Extract email content from the ProtonMail message view.
 * 
 * @param container The container element for the message view.
 * @returns An ExtractionResult containing the EmailData.
 */
export function extractProtonEmailContent(container: HTMLElement): ExtractionResult {
    const warnings: string[] = [];

    // ProtonMail selectors (refined from live inspection and shadow DOM awareness)
    const selectors = {
        subject: '[data-testid="conversation-header:subject"], [data-testid="message-subject"], [data-testid^="message-view"] h1, h1.text-3xl, .message-subject',
        from: '[data-testid="recipients:sender"], [data-testid="message-header-sender"], .message-sender',
        to: '[data-testid^="recipients:item-"]',
        body: '[data-testid^="message-view"] .message-content iframe, [data-testid^="message-view"] .message-content, #message-body, .message-content',
        date: '[data-testid^="message-view"] time, [data-testid="message-header-date"], .message-date-time'
    };

    // Sometimes subject is only in the main conversation header, outside the specific message container
    const subjectEl = container.querySelector(selectors.subject) || document.querySelector(selectors.subject);
    const fromEl = container.querySelector(selectors.from);
    const toEls = Array.from(container.querySelectorAll(selectors.to));
    const bodyEl = container.querySelector(selectors.body);
    const dateEl = container.querySelector(selectors.date);

    const subject = subjectEl?.getAttribute('title') || subjectEl?.textContent?.trim() || '';
    const from = fromEl?.getAttribute('title') || fromEl?.textContent?.trim() || '';
    
    // Filter out "Show details" noise from recipients
    const to = toEls.map(el => {
        const text = el.getAttribute('title') || el.textContent?.trim() || '';
        return text.replace(/Show details|Pokaż szczegóły/gi, '').trim();
    }).filter(Boolean);
    
    // Body content handling (Pierce Shadow DOM & iframes, get innerHTML for link extraction)
    let bodyText = '';
    
    // Find all possible body hosts (including children of the main selector)
    const contentHosts = Array.from(container.querySelectorAll('.message-content, [data-testid="message-content"]'));
    if (bodyEl && !contentHosts.includes(bodyEl as HTMLElement)) {
        contentHosts.push(bodyEl as HTMLElement);
    }
    
    for (const host of contentHosts) {
        if (host instanceof HTMLIFrameElement) {
            try {
                bodyText = host.contentDocument?.body?.innerHTML || host.contentWindow?.document?.body?.innerHTML || '';
                if (bodyText) break;
            } catch (e) {
                console.warn('[CheckMailPlugin] Could not access Proton body iframe content:', e);
            }
        } else if (host.shadowRoot) {
            // Proton often isolates email HTML using Shadow DOM
            const protonRoot = host.shadowRoot.getElementById('proton-root');
            bodyText = protonRoot ? protonRoot.innerHTML : host.shadowRoot.innerHTML;
            if (bodyText) break;
        } else {
            // Check direct children for shadow roots as well (sometimes wrapper elements don't host the shadow themselves)
            const childWithShadow = Array.from(host.children).find(c => c.shadowRoot);
            if (childWithShadow?.shadowRoot) {
                const protonRoot = childWithShadow.shadowRoot.getElementById('proton-root');
                bodyText = protonRoot ? protonRoot.innerHTML : childWithShadow.shadowRoot.innerHTML;
                if (bodyText) break;
            }
            // Standard fallback
            bodyText = host.innerHTML || '';
            if (bodyText && bodyText.trim().length > 0) break;
        }
    }
    
    // Absolute fallback if everything else fails
    if (!bodyText && bodyEl) {
        bodyText = (bodyEl as HTMLElement).innerHTML || (bodyEl as HTMLElement).textContent || bodyEl.getAttribute('title') || '';
    }
    
    const date = dateEl?.getAttribute('title') || dateEl?.textContent?.trim() || new Date().toLocaleString();

    if (!subject) warnings.push('Subject not found');
    if (!from) warnings.push('Sender (From) not found');
    if (to.length === 0) warnings.push('Recipients (To) not found');
    if (!bodyText) warnings.push('Body text not found');

    const data: EmailData = {
        from,
        to,
        cc: [],
        subject,
        date,
        bodyText,
        extractionTimestamp: new Date().toISOString(),
    };

    return {
        success: warnings.length === 0,
        warnings,
        source: subject || from || 'Proton Message',
        data,
    };
}

/**
 * Extract raw email source from ProtonMail's "Show headers" modal.
 * 
 * @returns The raw text content of the email headers/source.
 */
export function extractProtonRawContent(): string {
    // Search within the relative modal or dialog tags
    const modal = document.querySelector('.modal-two, [role="dialog"]');
    if (modal) {
        // Look for the header container text area
        const contentArea = modal.querySelector('pre, .flex-item-fluid-auto.p-4'); 
        if (contentArea) return contentArea.textContent || '';
    }

    // Fallback: look for any element that looks like headers
    const elements = Array.from(document.querySelectorAll('pre, div'));
    for (const el of elements) {
        const text = el.textContent || '';
        if (text.includes('Return-Path:') && text.includes('Received:') && text.length > 100) {
            return text;
        }
    }
                    
    return '';
}

/**
 * Simple parser for ProtonMail raw headers if they are available standalone.
 */
export function parseProtonHeaders(rawText: string): Record<string, string | string[]> {
    const headers: Record<string, string | string[]> = {};
    
    // Proton "Message headers" view often shows just the header block.
    // Lines are usually \n or \r\n
    const lines = rawText.split(/\r?\n/);
    
    let currentKey = '';
    let currentValue = '';

    for (const line of lines) {
        if (line.match(/^\s+/)) {
            // Continuation line
            if (currentKey) {
                currentValue += ' ' + line.trim();
            }
        } else {
            // New header line
            if (currentKey) {
                appendHeader(headers, currentKey, currentValue);
            }
            
            const colonIdx = line.indexOf(':');
            if (colonIdx > 0) {
                currentKey = line.substring(0, colonIdx).trim().toLowerCase();
                currentValue = line.substring(colonIdx + 1).trim();
            } else {
                currentKey = '';
                currentValue = '';
            }
        }
    }
    
    // Flush last
    if (currentKey) {
        appendHeader(headers, currentKey, currentValue);
    }

    return headers;
}

function appendHeader(headers: Record<string, string | string[]>, key: string, value: string) {
    const existing = headers[key];
    if (existing === undefined) {
        headers[key] = value;
    } else if (Array.isArray(existing)) {
        existing.push(value);
    } else {
        headers[key] = [existing, value];
    }
}
