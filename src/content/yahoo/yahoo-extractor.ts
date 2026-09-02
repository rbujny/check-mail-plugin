import type { EmailData, ExtractionResult } from '../../types/email';

export function extractYahooEmailContent(container: HTMLElement): ExtractionResult {
    const warnings: string[] = [];

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

    const dateEl = container.querySelector('[data-test-id="message-header"] span') ||
        container.querySelector('.message-header-date');

    const subject = subjectEl?.textContent?.trim() || '';

    const from = fromEl?.getAttribute('title') || fromEl?.getAttribute('aria-label') || fromEl?.textContent?.trim() || '';

    const toContainer = container.querySelector(selectors.to);
    const to = Array.from(toContainer?.children || [])
        .slice(1)
        .map(el => {
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
        cc: [],
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

export function extractYahooRawContent(): string {
    const pre = document.querySelector('pre');
    return pre?.textContent || '';
}
