/**
 * Email content extraction module for CheckMailPlugin.
 *
 * Extracts visible email metadata (from, to, cc, subject, date)
 * and body text from Gmail's DOM within a specific message container.
 */

import type { EmailData, ExtractionResult } from '../../types/email';

/**
 * Extracts text content from an element, returning a fallback if not found.
 */
function safeTextContent(
    container: HTMLElement,
    selectors: string[],
    fallback: string = ''
): string {
    for (const selector of selectors) {
        const el = container.querySelector<HTMLElement>(selector);
        if (el) {
            const text = el.innerText?.trim() || el.textContent?.trim() || '';
            if (text) return text;
        }
    }
    return fallback;
}

/**
 * Extracts the sender (From) field from a message container.
 * Gmail displays the sender in elements with specific attributes.
 */
function extractFrom(container: HTMLElement): string {
    // Gmail uses [email] attribute on sender element, or data-hovercard-id
    const senderEl = container.querySelector<HTMLElement>(
        '[email], [data-hovercard-id], .gD, .go'
    );
    if (senderEl) {
        const email = senderEl.getAttribute('email') || senderEl.getAttribute('data-hovercard-id') || '';
        const name = senderEl.getAttribute('name') || senderEl.innerText?.trim() || '';
        if (name && email) return `${name} <${email}>`;
        if (email) return email;
        if (name) return name;
    }

    // Fallback: look for the first prominent text in the header area
    return safeTextContent(container, ['h3.iw', '.gD', 'span[email]'], '[extraction failed]');
}

/**
 * Extracts recipient fields (To, Cc) from a message container.
 * Returns arrays of recipient strings.
 */
function extractRecipients(container: HTMLElement): { to: string[]; cc: string[] } {
    const to: string[] = [];
    const cc: string[] = [];

    // Look for the expanded header section with recipient details
    const headerTable = container.querySelector<HTMLElement>('.ajv, table.cf');

    if (headerTable) {
        // Gmail structures recipients in rows within the header table
        const rows = headerTable.querySelectorAll<HTMLElement>('tr, .ajA');
        rows.forEach((row) => {
            const labelEl = row.querySelector<HTMLElement>('td:first-child, .aHI');
            const valueEl = row.querySelector<HTMLElement>('td:nth-child(2), .ajA span[email]');
            const label = labelEl?.textContent?.trim()?.toLowerCase() || '';

            if (label.includes('to') || label.includes('do') || label.includes('à')) {
                const emails = row.querySelectorAll<HTMLElement>('[email]');
                emails.forEach((e) => {
                    const addr = e.getAttribute('email') || e.innerText?.trim() || '';
                    if (addr) to.push(addr);
                });
                // Fallback: use text content
                if (to.length === 0 && valueEl) {
                    const text = valueEl.innerText?.trim();
                    if (text) to.push(text);
                }
            } else if (label.includes('cc') || label.includes('dw')) {
                const emails = row.querySelectorAll<HTMLElement>('[email]');
                emails.forEach((e) => {
                    const addr = e.getAttribute('email') || e.innerText?.trim() || '';
                    if (addr) cc.push(addr);
                });
                if (cc.length === 0 && valueEl) {
                    const text = valueEl.innerText?.trim();
                    if (text) cc.push(text);
                }
            }
        });
    }

    // If we couldn't find recipients through the header table,
    // try extracting from the collapsed header line
    if (to.length === 0) {
        const toMeEl = container.querySelector<HTMLElement>('.g3, span.hb');
        if (toMeEl) {
            const text = toMeEl.innerText?.trim();
            if (text) to.push(text);
        }
    }

    // Ensure we always return at least a fallback for 'to'
    if (to.length === 0) {
        to.push('[extraction failed]');
    }

    return { to, cc };
}

/**
 * Extracts the subject line from the page.
 * The subject is typically shared across all messages in a thread
 * and displayed in the conversation title.
 */
function extractSubject(): string {
    // Gmail shows the subject in the conversation title area
    const subjectEl = document.querySelector<HTMLElement>(
        'h2.hP, [data-thread-perm-id] h2, .ha h2'
    );
    if (subjectEl) {
        return subjectEl.innerText?.trim() || '';
    }

    // Fallback: title element sometimes contains the subject
    const titleParts = document.title.split(' - ');
    if (titleParts.length > 1) {
        return titleParts[0].trim();
    }

    return '';
}

/**
 * Extracts the date from a message container.
 * Gmail displays the date in a span with a title attribute containing
 * the full timestamp.
 */
function extractDate(container: HTMLElement): string {
    // The date element usually has a title attribute with the full date
    const dateEl = container.querySelector<HTMLElement>('.g3, span.g3, [title]');
    if (dateEl) {
        // Prefer the title attribute (full date) over the displayed text (relative)
        const fullDate = dateEl.getAttribute('title');
        if (fullDate && fullDate.includes(':')) return fullDate;
        const text = dateEl.innerText?.trim();
        if (text) return text;
    }

    // Look specifically for date spans in the header
    const allSpans = container.querySelectorAll<HTMLElement>('span[title]');
    for (const span of allSpans) {
        const title = span.getAttribute('title') || '';
        // Dates typically contain a colon (for time) and are longer than 10 chars
        if (title.includes(':') && title.length > 10) {
            return title;
        }
    }

    return '';
}

/**
 * Preprocesses the email body HTML to preserve link URLs before
 * extracting plain text via innerText.
 *
 * Converts <a href="url">text</a> to text (url) format.
 */
function preprocessLinks(bodyElement: HTMLElement): void {
    const links = bodyElement.querySelectorAll<HTMLAnchorElement>('a[href]');
    links.forEach((link) => {
        const href = link.getAttribute('href') || '';
        const text = link.innerText?.trim() || '';

        // Skip Gmail internal links and mail-to links that match the text
        if (href.startsWith('#') || href === text || href.startsWith('mailto:')) {
            return;
        }

        // Replace the link with " text (url) " or " url " format
        // Padding with spaces guarantees separation from adjacent text when reading innerText
        const replacementText = text ? ` ${text} (${href}) ` : ` ${href} `;
        const replacement = document.createTextNode(replacementText);
        link.replaceWith(replacement);
    });
}

/**
 * Extracts the body text from a message container.
 * Uses innerText for readable output with preserved line breaks.
 *
 */
function extractBody(container: HTMLElement): string {
    // Gmail message bodies are in elements with class 'a3s' or similar
    const bodyEl = container.querySelector<HTMLElement>(
        '.a3s, [data-message-id] .ii, .msg, div[dir="ltr"]'
    );

    if (!bodyEl) {
        return '';
    }

    // Clone to avoid modifying the actual DOM
    const clone = bodyEl.cloneNode(true) as HTMLElement;
    preprocessLinks(clone);

    return clone.innerText?.trim() || '';
}

/**
 * Main extraction function. Extracts all visible email content from
 * a specific message container and returns a typed ExtractionResult.
 *
 * @param messageContainer - The DOM element wrapping a single email message
 * @returns ExtractionResult with extracted data and any warnings
 */
export function extractEmailContent(messageContainer: HTMLElement): ExtractionResult {
    const warnings: string[] = [];
    const extractionTimestamp = new Date().toISOString();

    // Extract each field
    const from = extractFrom(messageContainer);
    if (from === '[extraction failed]') {
        warnings.push('Could not extract sender (From) from DOM');
    }

    const { to, cc } = extractRecipients(messageContainer);
    if (to.length === 1 && to[0] === '[extraction failed]') {
        warnings.push('Could not extract recipients (To) from DOM');
    }

    const subject = extractSubject();
    const date = extractDate(messageContainer);
    if (!date) {
        warnings.push('Could not extract date from DOM');
    }

    const bodyText = extractBody(messageContainer);
    if (!bodyText) {
        warnings.push('Email body is empty or could not be extracted');
    }

    // Build EmailData
    const data: EmailData = {
        from,
        to,
        cc,
        subject,
        date,
        bodyText,
        extractionTimestamp,
    };

    // Determine success: true only if all required fields extracted
    // without fallback values (per data-model.md validation rules)
    const success =
        from !== '[extraction failed]' &&
        !(to.length === 1 && to[0] === '[extraction failed]') &&
        date !== '' &&
        // subject and bodyText MAY be empty legitimately
        true;

    // Determine source identifier
    let source = subject || from;
    if (!source || source === '[extraction failed]') {
        source = '[unknown source]';
    }

    return {
        success,
        warnings,
        source,
        data,
    };
}
