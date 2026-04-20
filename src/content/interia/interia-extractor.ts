/**
 * Interia Mail (poczta.interia.pl) email content extractor.
 *
 * Extracts simplified email data from the Interia Mail standard message view
 * and raw MIME text from the "Pokaż nagłówki" / "Źródło wiadomości" view.
 */

import type { EmailData, ExtractionResult } from '../../types/email';

/**
 * Extract email content from the Interia Mail standard message view.
 *
 * Interia Mail renders emails in a reading pane with toolbar buttons above.
 * Selectors target Interia's data attributes and semantic class names.
 *
 * @param container - The DOM element containing the email message.
 * @returns An ExtractionResult with simplified EmailData.
 */
export function extractInteriaEmailContent(container: HTMLElement): ExtractionResult {
    const warnings: string[] = [];

    // Interia Mail DOM selectors — subject, sender, recipients, body, date
    const subjectEl =
        container.querySelector<HTMLElement>('h1.message-header__subject') ||
        container.querySelector<HTMLElement>('[data-qa="message-subject"]') ||
        container.querySelector<HTMLElement>('.subject-line');

    const fromEl =
        container.querySelector<HTMLElement>('h2.message__toolbar__users__from') ||
        container.querySelector<HTMLElement>('[data-qa="message-from"]') ||
        container.querySelector<HTMLElement>('.sender-info');

    const fromMailEl = container.querySelector<HTMLElement>('h2.message__toolbar__users__from-mail');

    const toContainer =
        container.querySelector<HTMLElement>('.message__toolbar__users__to') ||
        container.querySelector<HTMLElement>('[data-qa="message-to"]') ||
        container.querySelector<HTMLElement>('.recipient-list');

    // Interia renders the email payload in an about:blank iframe
    const iframe = container.querySelector<HTMLIFrameElement>('iframe.message__iframe') ||
                   container.querySelector<HTMLIFrameElement>('iframe.message-iframe');

    const bodyEl =
        iframe?.contentDocument?.body ||
        container.querySelector<HTMLElement>('.message__content') ||
        container.querySelector<HTMLElement>('[data-qa="message-body"]') ||
        container.querySelector<HTMLElement>('.message-content') ||
        container.querySelector<HTMLElement>('.mail-body');

    const dateEl =
        container.querySelector<HTMLElement>('.message__toolbar__details__item--date') ||
        container.querySelector<HTMLElement>('[data-qa="message-date"]') ||
        container.querySelector<HTMLElement>('.message-date');

    const subject = subjectEl?.textContent?.trim() || '';
    
    // Attempt to get the dedicated email element first, then fallback to name/title
    const from = fromMailEl?.textContent?.trim() ||
                 fromEl?.getAttribute('title') || 
                 fromEl?.textContent?.trim() || '';

    const to = toContainer
        ? Array.from(toContainer.querySelectorAll('span, a'))
              .map(el => (el.getAttribute('data-tooltip') || el.getAttribute('title') || el.textContent?.trim() || '').replace(/^Do:\s*/i, '').trim())
              .filter(text => text && text !== ',' && text !== ';' && !text.endsWith(':'))
        : [];

    const bodyText = bodyEl?.innerHTML?.trim() || bodyEl?.innerText?.trim() || '';
    const date = dateEl?.getAttribute('data-tooltip') || dateEl?.textContent?.trim() || new Date().toLocaleString();

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
        source: subject || from || 'Interia Mail Message',
        data,
    };
}

/**
 * Extract raw email source from Interia's "Pokaż nagłówki" / "Źródło wiadomości" view.
 *
 * The raw view typically renders the full MIME payload in a <pre>
 * or a dedicated source container.
 *
 * @returns The raw text content of the email, or empty string if not found.
 */
export function extractInteriaRawContent(): string {
    const pre = document.querySelector<HTMLElement>('pre');
    if (pre) return pre.textContent || '';

    // Fallback: look for a dedicated source container
    const sourceContainer =
        document.querySelector<HTMLElement>('.source-view') ||
        document.querySelector<HTMLElement>('[data-qa="message-source"]');
    return sourceContainer?.textContent || '';
}

/**
 * Extracts parsed raw headers from the Interia details table if it is visible.
 *
 * @returns A dictionary of raw headers, or null if the table is not found.
 */
export function extractInteriaDetailsTable(): Record<string, string | string[]> | null {
    const table = document.querySelector<HTMLElement>('table.message__details__table');
    if (!table) return null;

    const headers: Record<string, string | string[]> = {};
    const rows = table.querySelectorAll('tr.message__details__table__row');
    
    for (const row of rows) {
        const keyEl = row.querySelector('.message__details__table__key');
        const valEl = row.querySelector('.message__details__table__value');
        
        if (keyEl && valEl) {
            const key = keyEl.textContent?.trim();
            const value = valEl.textContent?.trim() || '';
            if (key) {
                if (headers[key]) {
                    if (Array.isArray(headers[key])) {
                        (headers[key] as string[]).push(value);
                    } else {
                        headers[key] = [headers[key] as string, value];
                    }
                } else {
                    headers[key] = value;
                }
            }
        }
    }
    
    return Object.keys(headers).length > 0 ? headers : null;
}
