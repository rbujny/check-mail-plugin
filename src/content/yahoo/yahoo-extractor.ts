import type { EmailData, ExtractionResult } from '../../types/email';

/**
 * Extract email content from the Yahoo Mail message view.
 * 
 * @param container The container element for the message view (standard or raw).
 * @returns An ExtractionResult containing the EmailData.
 */
export function extractYahooEmailContent(container: HTMLElement): ExtractionResult {
    const warnings: string[] = [];

    // Selectors based on Yahoo Mail data-test-id attributes
    const selectors = {
        subject: '[data-test-id="message-group-subject-text"]',
        from: '[data-test-id="message-view"] [data-test-id="with-contact-card-anchor"]',
        to: '[data-test-id="message-recipients"]',
        body: '[data-test-id="message-view-body-content"]',
    };

    const subjectEl = container.querySelector(selectors.subject) ||
        container.querySelector('.thread-subject');
    const fromEl = container.querySelector(selectors.from) ||
        container.querySelector('.message-header-from');
    const toEls = Array.from(container.querySelectorAll(selectors.to));
    const bodyEl = container.querySelector(selectors.body) ||
        container.querySelector('[data-test-id="message-view-body"]');

    // Yahoo often displays date in a span near the sender
    const dateEl = container.querySelector('[data-test-id="message-header"] span') ||
        container.querySelector('.message-header-date');

    const subject = subjectEl?.textContent?.trim() || '';

    // In Yahoo, the 'From' name is often in a contact card anchor.
    // We try to get the full identity from title/aria-label if available.
    const from = fromEl?.getAttribute('title') || fromEl?.getAttribute('aria-label') || fromEl?.textContent?.trim() || '';

    // Language-independent recipient extraction:
    // The first span child is consistently the label (e.g. "To:", "Do:", "Cc:").
    // Subsequent children are the actual recipient names/tokens.
    const toContainer = container.querySelector(selectors.to);
    const to = Array.from(toContainer?.children || [])
        .slice(1) // Language-independent: skip the first child span (the label)
        .map(el => {
            // Try to get clean identity from attributes first
            const identity = el.getAttribute('title') || el.getAttribute('aria-label') || el.textContent?.trim() || '';
            return identity;
        })
        .filter(text => text && text !== ',' && text !== ';' && text !== ' ');

    const bodyText = (bodyEl as HTMLElement | null)?.innerHTML?.trim() || (bodyEl as HTMLElement | null)?.innerText?.trim() || '';
    const date = dateEl?.textContent?.trim() || new Date().toLocaleString();

    if (!subject) warnings.push('Subject not found');
    if (!from) warnings.push('Sender (From) not found');
    if (to.length === 0) warnings.push('Recipients (To) not found');
    if (!bodyText) warnings.push('Body text not found');

    const data: EmailData = {
        from,
        to,
        cc: [], // CC often nested in expandable headers, for v1 we focus on primary recipients
        subject,
        date,
        bodyText,
        extractionTimestamp: new Date().toISOString(),
    };

    return {
        success: warnings.length === 0,
        warnings,
        source: subject || from || 'Yahoo Mail Message',
        data,
    };
}

/**
 * Extract raw email source from Yahoo's "View Raw Message" page.
 * 
 * @returns The raw text content of the email.
 */
export function extractYahooRawContent(): string {
    const pre = document.querySelector('pre');
    return pre?.textContent || '';
}
