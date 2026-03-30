import type { EmailData, ExtractionResult } from '../../types/email';

/**
 * Extract email content from the ProtonMail message view.
 * 
 * @param container The container element for the message view.
 * @returns An ExtractionResult containing the EmailData.
 */
export function extractProtonEmailContent(container: HTMLElement): ExtractionResult {
    const warnings: string[] = [];

    // ProtonMail selectors (refined from live inspection)
    const selectors = {
        subject: '[data-testid="conversation-header:subject"], [data-testid^="message-view"] h1, .message-subject',
        from: '[data-testid="recipients:sender"], .message-sender',
        to: '[data-testid^="recipients:item-"]',
        body: '[data-testid^="message-view"] .message-content iframe, [data-testid^="message-view"] .message-content, #message-body',
        date: '[data-testid^="message-view"] time, .message-date-time'
    };

    const subjectEl = container.querySelector(selectors.subject);
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
    
    // Body content handling (handle iframe)
    let bodyText = '';
    if (bodyEl instanceof HTMLIFrameElement) {
        try {
            bodyText = bodyEl.contentDocument?.body?.innerText || bodyEl.contentWindow?.document?.body?.innerText || '';
        } catch (e) {
            console.warn('[CheckMailPlugin] Could not access Proton body iframe content:', e);
            bodyText = bodyEl.title || ''; // Fallback
        }
    } else {
        bodyText = (bodyEl as HTMLElement | null)?.innerText?.trim() || '';
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
