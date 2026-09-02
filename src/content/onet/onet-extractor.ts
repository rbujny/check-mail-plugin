
import type { EmailData, ExtractionResult } from '../../types/email';

export function extractOnetEmailContent(container: HTMLElement): ExtractionResult {
    const warnings: string[] = [];

    let subject = '';

    const headings = Array.from(document.querySelectorAll('h1, h2, h3'));
    for (const h of headings) {
        const text = h.textContent?.trim();
        if (text && text.length > 2 && text.length < 500) {
            subject = text;
            break;
        }
    }

    if (!subject) {
        const title = document.title;
        const cleaned = title
            .replace(/\s*[-–|]\s*(Poczta|Onet|poczta\.onet\.pl).*$/i, '')
            .trim();
        if (cleaned && cleaned.length > 0 && cleaned !== title) {
            subject = cleaned;
        }
    }

    let senderBlock: HTMLElement | null = null;

    const detailsBtn = document.querySelector<HTMLElement>(
        'button[title="Szczegóły wiadomości"]'
    );
    if (detailsBtn) {
        const recipientRow = detailsBtn.closest('div');
        senderBlock = (recipientRow?.parentElement as HTMLElement) || null;
    }

    if (!senderBlock) {
        const figures = document.querySelectorAll('figure');
        for (const fig of figures) {
            const parent = fig.parentElement as HTMLElement;
            if (parent && parent.querySelector('span') && parent.querySelector('b')) {
                senderBlock = parent;
                break;
            }
        }
    }

    let from = '';
    if (senderBlock) {
        const spans = senderBlock.querySelectorAll('span');
        for (const span of spans) {
            const text = span.textContent?.trim() || '';
            if (text.includes('@') && text.includes('.')) {
                from = text;
                break;
            }
        }
        if (!from) {
            const bold = senderBlock.querySelector('b');
            if (bold) from = bold.textContent?.trim() || '';
        }
    }

    const to: string[] = [];
    if (senderBlock) {
        const spans = senderBlock.querySelectorAll('span');
        for (const span of spans) {
            const text = span.textContent?.trim() || '';
            if (/^(do |Do )/i.test(text)) {
                to.push(text);
            }
        }
    }

    let date = '';
    if (senderBlock) {
        const spans = senderBlock.querySelectorAll('span');
        for (const span of spans) {
            const text = span.textContent?.trim() || '';
            if (/\d{2}\.\d{2}\.\d{4}/.test(text)) {
                date = text;
                break;
            }
        }
    }
    if (!date) date = new Date().toLocaleString();

    const iframe =
        container.querySelector<HTMLIFrameElement>('iframe[srcdoc]') ||
        container.querySelector<HTMLIFrameElement>('iframe');
    let bodyText = '';

    if (iframe) {
        try {
            const bodyEl = iframe.contentDocument?.body || iframe.contentWindow?.document?.body;
            bodyText = bodyEl?.innerHTML?.trim() || bodyEl?.innerText?.trim() || '';
        } catch (e) {
            console.warn('[CheckMailPlugin][Onet] Could not access iframe body:', e);
        }
    }

    if (!bodyText) {
        const iframeWrapper = container.querySelector('div.mail-detail-iframe');
        if (iframeWrapper) {
            bodyText = (iframeWrapper as HTMLElement).innerHTML?.trim() || (iframeWrapper as HTMLElement).innerText?.trim() || '';
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
        source: subject || from || 'Onet Mail Message',
        data,
    };
}

export function extractOnetRawContent(): string {
    const tabPanel = document.querySelector('#tab-panel-headers');
    if (tabPanel) {
        const listItems = tabPanel.querySelectorAll('li');
        if (listItems.length > 0) {
            const lines: string[] = [];
            for (const li of listItems) {
                const bold = li.querySelector('b');
                if (bold) {
                    const headerName = bold.textContent?.trim() || '';
                    const fullText = li.textContent?.trim() || '';
                    const boldText = bold.textContent || '';
                    const rest = fullText.substring(boldText.length).trim();
                    lines.push(headerName + rest);
                } else {
                    lines.push('\t' + (li.textContent?.trim() || ''));
                }
            }
            return lines.join('\n');
        }
    }

    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
    for (const dialog of dialogs) {
        if (dialog.textContent?.includes('Received:') && dialog.textContent?.includes('Nagłówki wiadomości')) {
            const candidates = dialog.querySelectorAll<HTMLElement>('[role="tabpanel"], pre, div');
            for (const area of candidates) {
                const areaText = area.textContent || '';
                if (areaText.includes('Received:') && areaText.length > 100 && !area.querySelector('button')) {
                    return areaText;
                }
            }
        }
    }

    const pre = document.querySelector<HTMLElement>('pre');
    if (pre && pre.textContent?.includes('Received:')) {
        return pre.textContent || '';
    }

    const sourceContainer =
        document.querySelector<HTMLElement>('.message-source') ||
        document.querySelector<HTMLElement>('[data-test="mail-source"]');
    return sourceContainer?.textContent || '';
}
