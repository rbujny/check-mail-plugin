
import type { EmailData, ExtractionResult } from '../../types/email';

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

function extractFrom(container: HTMLElement): string {
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

    return safeTextContent(container, ['h3.iw', '.gD', 'span[email]'], '[extraction failed]');
}

function extractRecipients(container: HTMLElement): { to: string[]; cc: string[] } {
    const to: string[] = [];
    const cc: string[] = [];

    const headerTable = container.querySelector<HTMLElement>('.ajv, table.cf');

    if (headerTable) {
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

    if (to.length === 0) {
        const toMeEl = container.querySelector<HTMLElement>('.g3, span.hb');
        if (toMeEl) {
            const text = toMeEl.innerText?.trim();
            if (text) to.push(text);
        }
    }

    if (to.length === 0) {
        to.push('[extraction failed]');
    }

    return { 
        to: Array.from(new Set(to)), 
        cc: Array.from(new Set(cc)) 
    };
}

function extractSubject(): string {
    const subjectEl = document.querySelector<HTMLElement>(
        'h2.hP, [data-thread-perm-id] h2, .ha h2'
    );
    if (subjectEl) {
        return subjectEl.innerText?.trim() || '';
    }

    const titleParts = document.title.split(' - ');
    if (titleParts.length > 1) {
        return titleParts[0].trim();
    }

    return '';
}

function extractDate(container: HTMLElement): string {
    const dateEl = container.querySelector<HTMLElement>('.g3, span.g3, [title]');
    if (dateEl) {
        const fullDate = dateEl.getAttribute('title');
        if (fullDate && fullDate.includes(':')) return fullDate;
        const text = dateEl.innerText?.trim();
        if (text) return text;
    }

    const allSpans = container.querySelectorAll<HTMLElement>('span[title]');
    for (const span of allSpans) {
        const title = span.getAttribute('title') || '';
        if (title.includes(':') && title.length > 10) {
            return title;
        }
    }

    return '';
}

function preprocessLinks(bodyElement: HTMLElement): void {
    const links = bodyElement.querySelectorAll<HTMLAnchorElement>('a[href]');
    links.forEach((link) => {
        const href = link.getAttribute('href') || '';
        const text = link.innerText?.trim() || '';

        if (href.startsWith('#') || href === text || href.startsWith('mailto:')) {
            return;
        }

        const replacementText = text ? ` ${text} (${href}) ` : ` ${href} `;
        const replacement = document.createTextNode(replacementText);
        link.replaceWith(replacement);
    });
}

function extractBody(container: HTMLElement): string {
    const bodyEl = container.querySelector<HTMLElement>(
        '.a3s, [data-message-id] .ii, .msg, div[dir="ltr"]'
    );

    if (!bodyEl) {
        return '';
    }

    const clone = bodyEl.cloneNode(true) as HTMLElement;
    preprocessLinks(clone);

    return clone.innerText?.trim() || '';
}

export function extractEmailContent(messageContainer: HTMLElement): ExtractionResult {
    const warnings: string[] = [];
    const extractionTimestamp = new Date().toISOString();

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

    const data: EmailData = {
        from,
        to,
        cc,
        subject,
        date,
        bodyText,
        extractionTimestamp,
    };

    const success =
        from !== '[extraction failed]' &&
        !(to.length === 1 && to[0] === '[extraction failed]') &&
        date !== '' &&
        true;

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
