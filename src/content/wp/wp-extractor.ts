/**
 * WP Mail (poczta.wp.pl) email content extractor.
 *
 * Extracts simplified email data from the WP Mail standard message view
 * and raw MIME text from the "Pokaż źródło" (Show source) view.
 */

import type { EmailData, ExtractionResult } from '../../types/email';

/**
 * Extract email content from the WP Mail standard message view.
 *
 * WP Mail renders emails in a reading pane with toolbar buttons above.
 * Selectors target WP's data attributes and semantic class names.
 *
 * @param container - The DOM element containing the email message.
 * @returns An ExtractionResult with simplified EmailData.
 */
export function extractWpEmailContent(container: HTMLElement): ExtractionResult {
    const warnings: string[] = [];

    // WP Mail DOM selectors update based on new frontend
    
    // Subject
    let subject = '';
    const subjectEl =
        container.querySelector<HTMLElement>('.textStyle_h1') ||
        container.querySelector<HTMLElement>('.textStyle_h2 > div, .textStyle_h2') ||
        container.querySelector<HTMLElement>('[data-qa="mail-subject"]');
    if (subjectEl) subject = subjectEl.textContent?.trim() || '';

    // From
    let from = '';
    const fromEl = container.querySelector<HTMLElement>('[data-skip-link="mail-info"]') || container.querySelector<HTMLElement>('[data-qa="mail-from"]');
    if (fromEl) {
        from = fromEl.textContent?.trim() || '';
    }
    
    if (!from) {
        const odLabel = Array.from(container.querySelectorAll('div, span')).find(el => el.textContent?.trim() === 'Od:');
        if (odLabel && odLabel.nextElementSibling) {
            from = odLabel.nextElementSibling.textContent?.trim() || '';
        }
    }

    // To
    let to: string[] = [];
    const doLabel = Array.from(container.querySelectorAll('div, span')).find(el => el.textContent?.trim() === 'Do:');
    if (doLabel && doLabel.nextElementSibling) {
        const textArea = doLabel.nextElementSibling as HTMLElement;
        const text = textArea.innerText?.trim() || textArea.textContent?.trim() || '';
        if (text && text.toLowerCase() !== 'mnie') {
             to.push(text);
        }
    }
    if (to.length === 0) {
        const toEl = container.querySelector<HTMLElement>('[data-qa="mail-to"]');
        if (toEl && toEl.textContent) to.push(toEl.textContent.trim());
    }

    // Body
    let bodyText = '';
    const bodyEl = container.querySelector<HTMLElement>('[data-message-body="true"]') || container.querySelector<HTMLElement>('.mail-body');
    if (bodyEl) {
        bodyText = bodyEl.innerHTML?.trim() || bodyEl.innerText?.trim() || bodyEl.textContent?.trim() || '';
    }

    // Date
    let date = new Date().toLocaleString();
    const dateEl = container.querySelector<HTMLElement>('[data-qa="mail-date"]') || container.querySelector<HTMLElement>('.dateTime');
    if (dateEl) {
        date = dateEl.textContent?.trim() || date;
    } else {
        // Try finding a nowrap div with a year or date structure
        const nowraps = Array.from(container.querySelectorAll('.white-space_nowrap'));
        for (const el of nowraps) {
            const text = el.textContent?.trim() || '';
            if (/\d{4}/.test(text) || (/\d{2}:\d{2}/.test(text) && /[a-z]/i.test(text))) {
                date = text;
                break;
            }
        }
    }

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
        source: subject || from || 'WP Mail Message',
        data,
    };
}

/**
 * Extract raw email source from WP's "Pokaż źródło" (Show source) view.
 *
 * The raw view typically displays the MIME payload in a <pre> or
 * dedicated container element.
 *
 * @returns The raw text content of the email, or empty string if not found.
 */
export function extractWpRawContent(): string {
    // Ensure we are grabbing the pre inside the raw message modal if it exists
    const modalTitle = Array.from(document.querySelectorAll('.modal__title')).find(h => h.textContent?.trim() === 'Źródło wiadomości');
    if (modalTitle && modalTitle.parentElement) {
        const modalPre = modalTitle.parentElement.querySelector('pre');
        if (modalPre) return modalPre.textContent || '';
    }

    const pre = document.querySelector<HTMLElement>('pre');
    if (pre) return pre.textContent || '';

    // Fallback: look for a dedicated source container
    const sourceContainer =
        document.querySelector<HTMLElement>('.messageSource') ||
        document.querySelector<HTMLElement>('[data-qa="mail-source"]');
    return sourceContainer?.textContent || '';
}
