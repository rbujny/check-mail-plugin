import type { EmailData, ExtractionResult } from '../../types/email';

export function extractOutlookEmailContent(container: HTMLElement): ExtractionResult {
    const warnings: string[] = [];

    const selectors = {
        subject: '[id$="_SUBJECT"] span[title], [id$="_SUBJECT"], [data-testid="ReadingPaneSubject"], h2[id^="subject_"]',
        from: '[id$="_FROM"] span[aria-label], [id$="_FROM"] .OZZZK, [id$="_FROM"], [data-testid="PersonaHeader"], [data-test-id="PersonaHeader"], .ms-Persona',
        to: '[id$="_TO"] span.f1ee13vk, [id$="_TO"] [aria-label], [id$="_TO"], [data-testid="RecipientAddress"], [data-testid="RecipientName"]',
        body: '[id^="UniqueMessageBody_"], [aria-label="Treść wiadomości"][role="document"], #Item.MessagePartBody, .x_content, .reading-pane-section, [role="main"] .allowTextSelection',
    };

    const subjectEl = container.querySelector(selectors.subject) || 
                      container.querySelector('div[id^="subject"]');
    
    const fromEl = container.querySelector(selectors.from) || 
                   container.querySelector('[aria-label*="Od:"]');

    const toEl = container.querySelector(selectors.to) || 
                 container.querySelector('[aria-label*="Do:"]');

    const bodyEl = container.querySelector('.ii.gt') ||
                   container.querySelector('[id*="Body"]') ||
                   container.querySelector('.x_mail_body') ||
                   container.querySelector('.allowTextSelection');

    const subject = subjectEl?.textContent?.trim() || '';
    
    let from = fromEl?.getAttribute('title') || fromEl?.getAttribute('aria-label') || fromEl?.textContent?.trim() || '';
    from = from.replace(/^[^:]+:\s*/i, '').trim(); 

    const to = toEl ? [toEl.textContent?.replace(/^[^:]+:\s*/i, '').trim() || ''] : [];

    const bodyText = (bodyEl as HTMLElement | null)?.innerHTML?.trim() || (bodyEl as HTMLElement | null)?.innerText?.trim() || '';
    
    const dateEl = container.querySelector('[id*="Date"]') || container.querySelector('time');
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
        source: subject || from || 'Outlook Message',
        data,
    };
}

export function parseSMTPHeaders(rawText: string): Record<string, string | string[]> {
    const headers: Record<string, string | string[]> = {};
    const headerEnd = rawText.indexOf('\n\n') > 0 ? rawText.indexOf('\n\n') : rawText.indexOf('\r\n\r\n');
    
    if (headerEnd === -1) return headers;

    const headerBlock = rawText.substring(0, headerEnd);
    const unfolded = headerBlock.replace(/\r?\n([ \t]+)/g, ' $1');
    const lines = unfolded.split(/\r?\n/);

    for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
            const key = line.substring(0, colonIdx).trim();
            const value = line.substring(colonIdx + 1).trim();
            
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

    return headers;
}

export function extractOutlookRawContent(): string {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return '';

    const content = dialog.querySelector('pre') || 
                    dialog.querySelector('.fui-DialogContent') || 
                    dialog.querySelector('.ms-Dialog-main .allowTextSelection') ||
                    dialog.querySelector('.allowTextSelection');
                    
    return content?.textContent || '';
}
