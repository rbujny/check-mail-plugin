/**
 * Onet Mail (poczta.onet.pl) email content extractor.
 *
 * Extracts simplified email data from the Onet Mail standard message view
 * and raw header text from the "Nagłówki wiadomości" modal.
 *
 * Onet uses obfuscated CSS class names (CSS Modules / hashed classes like go1573949129).
 * Selectors must rely on structural/semantic patterns rather than class names:
 * - button[title="Szczegóły wiadomości"] as anchor for the sender block
 * - <figure> (avatar) adjacency to locate sender info
 * - Spans containing @ for email, date regex for date, "do " prefix for recipients
 * - Headings (h1-h3) or document.title for subject
 */

import type { EmailData, ExtractionResult } from '../../types/email';

/**
 * Extract email content from the Onet Mail standard message view.
 *
 * Uses structural DOM navigation anchored on known elements
 * (avatar figure, "Szczegóły wiadomości" button) to find sender metadata
 * despite obfuscated class names.
 *
 * @param container - The DOM element containing the email message (typically document.body).
 * @returns An ExtractionResult with simplified EmailData.
 */
export function extractOnetEmailContent(container: HTMLElement): ExtractionResult {
    const warnings: string[] = [];

    // ─── SUBJECT ────────────────────────────────────────────────────
    // Onet shows the subject in a heading element above the sender block.
    let subject = '';

    // Strategy 1: Look for heading elements in the mail reading area
    const headings = Array.from(document.querySelectorAll('h1, h2, h3'));
    for (const h of headings) {
        const text = h.textContent?.trim();
        if (text && text.length > 2 && text.length < 500) {
            subject = text;
            break;
        }
    }

    // Strategy 2: Page title — Onet formats it as "Subject - Poczta"
    if (!subject) {
        const title = document.title;
        const cleaned = title
            .replace(/\s*[-–|]\s*(Poczta|Onet|poczta\.onet\.pl).*$/i, '')
            .trim();
        if (cleaned && cleaned.length > 0 && cleaned !== title) {
            subject = cleaned;
        }
    }

    // ─── SENDER BLOCK (anchor-based navigation) ─────────────────────
    // The "Szczegóły wiadomości" button is always present in the sender row.
    // From it we navigate upward to find the sender info container.
    //
    // DOM structure (classes are obfuscated, structure is stable):
    //   div (sender container)
    //     figure (avatar circle with initial letter)
    //     div (info container)
    //       div → b (sender name) + span (sender email)
    //       div → span (date)
    //       div → span ("do mnie") + button[title="Szczegóły wiadomości"]
    //
    let senderBlock: HTMLElement | null = null;

    const detailsBtn = document.querySelector<HTMLElement>(
        'button[title="Szczegóły wiadomości"]'
    );
    if (detailsBtn) {
        // button is inside recipients-row div → info-container div
        const recipientRow = detailsBtn.closest('div');
        senderBlock = (recipientRow?.parentElement as HTMLElement) || null;
    }

    // Fallback: find the avatar <figure> and use its parent
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

    // ─── FROM ───────────────────────────────────────────────────────
    let from = '';
    if (senderBlock) {
        // Find the first span containing an email address (has @ and .)
        const spans = senderBlock.querySelectorAll('span');
        for (const span of spans) {
            const text = span.textContent?.trim() || '';
            if (text.includes('@') && text.includes('.')) {
                from = text;
                break;
            }
        }
        // Fallback: use the bold sender name
        if (!from) {
            const bold = senderBlock.querySelector('b');
            if (bold) from = bold.textContent?.trim() || '';
        }
    }

    // ─── TO ─────────────────────────────────────────────────────────
    const to: string[] = [];
    if (senderBlock) {
        const spans = senderBlock.querySelectorAll('span');
        for (const span of spans) {
            const text = span.textContent?.trim() || '';
            if (/^(do |Do )/i.test(text)) {
                // "do mnie" = "to me" — preserve as-is for context
                to.push(text);
            }
        }
    }

    // ─── DATE ───────────────────────────────────────────────────────
    let date = '';
    if (senderBlock) {
        const spans = senderBlock.querySelectorAll('span');
        for (const span of spans) {
            const text = span.textContent?.trim() || '';
            // Match Onet date format: DD.MM.YYYY, HH:MM
            if (/\d{2}\.\d{2}\.\d{4}/.test(text)) {
                date = text;
                break;
            }
        }
    }
    if (!date) date = new Date().toLocaleString();

    // ─── BODY ───────────────────────────────────────────────────────
    // Onet renders the email securely inside an iframe (often with srcdoc)
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

    // Fallback: look for a div wrapping an iframe
    if (!bodyText) {
        const iframeWrapper = container.querySelector('div.mail-detail-iframe');
        if (iframeWrapper) {
            bodyText = (iframeWrapper as HTMLElement).innerHTML?.trim() || (iframeWrapper as HTMLElement).innerText?.trim() || '';
        }
    }

    // ─── Warnings ───────────────────────────────────────────────────
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
 * Extract raw email headers from Onet's "Nagłówki wiadomości" modal.
 *
 * The modal contains a tab view with "Szczegóły wiadomości" and "Nagłówki wiadomości".
 * The headers tab shows formatted header text with bold labels.
 * We also check for the "Skopiuj do schowka" button as a modal anchor.
 *
 * @returns The raw text content of the email headers, or empty string if not found.
 */
export function extractOnetRawContent(): string {
    // Strategy 1: Structured extraction from #tab-panel-headers
    // The modal renders headers as <ul> → <li> elements.
    // Headers with <b> start a new header; <li> without <b> are continuation lines.
    const tabPanel = document.querySelector('#tab-panel-headers');
    if (tabPanel) {
        const listItems = tabPanel.querySelectorAll('li');
        if (listItems.length > 0) {
            const lines: string[] = [];
            for (const li of listItems) {
                const bold = li.querySelector('b');
                if (bold) {
                    // New header: "HeaderName: value"
                    const headerName = bold.textContent?.trim() || '';
                    // Get the rest of the text after the bold (the value portion)
                    const fullText = li.textContent?.trim() || '';
                    const boldText = bold.textContent || '';
                    const rest = fullText.substring(boldText.length).trim();
                    lines.push(headerName + rest);
                } else {
                    // Continuation line — indent with tab for MIME-style folding
                    lines.push('\t' + (li.textContent?.trim() || ''));
                }
            }
            return lines.join('\n');
        }
    }

    // Strategy 2: Find modal via "Skopiuj do schowka" button and extract text
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
    for (const dialog of dialogs) {
        if (dialog.textContent?.includes('Received:') && dialog.textContent?.includes('Nagłówki wiadomości')) {
            // Find the content area (not the buttons)
            const candidates = dialog.querySelectorAll<HTMLElement>('[role="tabpanel"], pre, div');
            for (const area of candidates) {
                const areaText = area.textContent || '';
                if (areaText.includes('Received:') && areaText.length > 100 && !area.querySelector('button')) {
                    return areaText;
                }
            }
        }
    }

    // Strategy 3: Legacy — raw view in a separate tab/page with <pre>
    const pre = document.querySelector<HTMLElement>('pre');
    if (pre && pre.textContent?.includes('Received:')) {
        return pre.textContent || '';
    }

    // Strategy 4: Dedicated source container
    const sourceContainer =
        document.querySelector<HTMLElement>('.message-source') ||
        document.querySelector<HTMLElement>('[data-test="mail-source"]');
    return sourceContainer?.textContent || '';
}
