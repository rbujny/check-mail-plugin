/**
 * Onet Mail (poczta.onet.pl) email content extractor.
 *
 * Extracts simplified email data from the Onet Mail standard message view
 * and raw MIME text from the "Pokaż źródło wiadomości" (Show message source) view.
 */

import type { EmailData, ExtractionResult } from '../../types/email';

/**
 * Extract email content from the Onet Mail standard message view.
 *
 * Onet Mail renders emails in a reading pane with toolbar buttons above.
 * Selectors target Onet's data attributes and semantic class names.
 *
 * @param container - The DOM element containing the email message.
 * @returns An ExtractionResult with simplified EmailData.
 */
export function extractOnetEmailContent(container: HTMLElement): ExtractionResult {
    const warnings: string[] = [];

    // Onet Mail DOM selectors — subject, sender, recipients, body, date
    const subjectEl =
        container.querySelector<HTMLElement>('[data-test="mail-subject"]') ||
        container.querySelector<HTMLElement>('.mail-subject') ||
        container.querySelector<HTMLElement>('h2.subject') ||
        container.querySelector<HTMLElement>('.subject');

    const fromEl =
        container.querySelector<HTMLElement>('[data-test="mail-from"]') ||
        container.querySelector<HTMLElement>('.sender-email') ||
        container.querySelector<HTMLElement>('.from-address') ||
        container.querySelector<HTMLElement>('.from');

    const toContainer =
        container.querySelector<HTMLElement>('[data-test="mail-to"]') ||
        container.querySelector<HTMLElement>('.recipients') ||
        container.querySelector<HTMLElement>('.to-address') ||
        container.querySelector<HTMLElement>('.to');

    // Onet renders the email payload securely inside an iframe with srcdoc
    const iframe = container.querySelector<HTMLIFrameElement>('div.mail-detail-iframe iframe') || 
                   container.querySelector<HTMLIFrameElement>('iframe[srcdoc]');

    const bodyEl =
        iframe?.contentDocument?.body ||
        iframe?.contentDocument?.getElementById('ReadMailMainWrapper') ||
        container.querySelector<HTMLElement>('[data-test="mail-body"]') ||
        container.querySelector<HTMLElement>('.mail-body-content') ||
        container.querySelector<HTMLElement>('.message-body') ||
        container.querySelector<HTMLElement>('div.mail-detail-iframe');

    const dateEl =
        container.querySelector<HTMLElement>('[data-test="mail-date"]') ||
        container.querySelector<HTMLElement>('.mail-date') ||
        container.querySelector<HTMLElement>('.message-date') ||
        container.querySelector<HTMLElement>('.date');

    const subject = subjectEl?.textContent?.trim() || '';
    const from = fromEl?.getAttribute('title') || fromEl?.textContent?.trim() || '';

    const to = toContainer
        ? Array.from(toContainer.querySelectorAll('span, a'))
              .map(el => el.getAttribute('title') || el.textContent?.trim() || '')
              .filter(text => text && text !== ',' && text !== ';' && !text.endsWith(':'))
        : [];

    const bodyText = bodyEl?.innerText?.trim() || '';
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
        source: subject || from || 'Onet Mail Message',
        data,
    };
}

/**
 * Extract raw email source from Onet's "Pokaż źródło wiadomości" view.
 *
 * The raw view typically opens in a new tab or popup displaying
 * the full MIME payload in a <pre> or dedicated container.
 *
 * @returns The raw text content of the email, or empty string if not found.
 */
export function extractOnetRawContent(): string {
    const pre = document.querySelector<HTMLElement>('pre');
    if (pre) return pre.textContent || '';

    // Fallback: look for a dedicated source container
    const sourceContainer =
        document.querySelector<HTMLElement>('.message-source') ||
        document.querySelector<HTMLElement>('[data-test="mail-source"]');
    return sourceContainer?.textContent || '';
}
