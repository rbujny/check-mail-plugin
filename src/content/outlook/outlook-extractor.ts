import type { EmailData, ExtractionResult } from '../../types/email';

/**
 * Extract email content from the Outlook message view.
 * 
 * @param container The container element for the message view.
 * @returns An ExtractionResult containing the EmailData.
 */
export function extractOutlookEmailContent(container: HTMLElement): ExtractionResult {
    const warnings: string[] = [];

    // Outlook selectors (refined to avoid navigation collisions)
    const selectors = {
        // Specifically look for subject in the reading pane
        subject: '[data-testid="ReadingPaneSubject"], h2[id^="subject_"]',
        // Sender info using test IDs or common persona classes
        from: '[data-testid="PersonaHeader"], [data-test-id="PersonaHeader"], .ms-Persona',
        // Recipients
        to: '[data-testid="RecipientAddress"], [data-testid="RecipientName"]',
        // Body content
        body: '#Item.MessagePartBody, .x_content, .reading-pane-section, [role="main"] .allowTextSelection',
    };

    const subjectEl = container.querySelector(selectors.subject) || 
                      container.querySelector('div[id^="subject"]');
    
    // In Outlook, the "From" can be complex. We try to find the persona/header.
    const fromEl = container.querySelector(selectors.from) || 
                   container.querySelector('[aria-label*="Od:"]');

    const toEl = container.querySelector(selectors.to) || 
                 container.querySelector('[aria-label*="Do:"]');

    // Body content in Outlook is often in a div with x_ prefix or specific classes
    const bodyEl = container.querySelector('.ii.gt') || // Gmail fallback? No, let's be Outlook specific
                   container.querySelector('[id*="Body"]') ||
                   container.querySelector('.x_mail_body') ||
                   container.querySelector('.allowTextSelection');

    const subject = subjectEl?.textContent?.trim() || '';
    
    let from = fromEl?.getAttribute('title') || fromEl?.getAttribute('aria-label') || fromEl?.textContent?.trim() || '';
    // Clean up localized prefixes and junk (handles many languages)
    from = from.replace(/^[^:]+:\s*/i, '').trim(); 

    // Recipients
    const to = toEl ? [toEl.textContent?.replace(/^[^:]+:\s*/i, '').trim() || ''] : [];

    // Body content handling - prioritize innerText for formatting preservation
    const bodyText = (bodyEl as HTMLElement | null)?.innerText?.trim() || '';
    
    // Date extraction
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

/**
 * Simple SMTP header parser.
 * Extracts key-value pairs and handles line folding.
 */
export function parseSMTPHeaders(rawText: string): Record<string, string | string[]> {
    const headers: Record<string, string | string[]> = {};
    const headerEnd = rawText.indexOf('\n\n') > 0 ? rawText.indexOf('\n\n') : rawText.indexOf('\r\n\r\n');
    
    if (headerEnd === -1) return headers;

    const headerBlock = rawText.substring(0, headerEnd);
    // Unfold folded lines (lines starting with space/tab)
    const unfolded = headerBlock.replace(/\r?\n([ \t]+)/g, ' $1');
    const lines = unfolded.split(/\r?\n/);

    for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
            const key = line.substring(0, colonIdx).trim();
            const value = line.substring(colonIdx + 1).trim();
            
            // Allow multiple headers (like Received)
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

/**
 * Extract raw email source from Outlook's "Source" dialog.
 * 
 * @returns The raw text content of the email.
 */
export function extractOutlookRawContent(): string {
    // Search within the dialog
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return '';

    // The "Source" is often in a pre tag or a div with scrollbars
    const content = dialog.querySelector('pre') || 
                    dialog.querySelector('.fui-DialogContent') || 
                    dialog.querySelector('.ms-Dialog-main .allowTextSelection') ||
                    dialog.querySelector('.allowTextSelection');
                    
    return content?.textContent || '';
}
