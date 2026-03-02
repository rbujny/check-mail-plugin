/**
 * Extractor for Gmail's "Show Original" view.
 */

import type { ExtractionResult, ExtendedEmailData } from '../types/email';

/**
 * Extracts the raw text payload from the page DOM.
 * Usually inside <pre> or .raw_message_text.
 */
function extractRawText(): string | null {
    // Attempt 1: Look for container with standard class
    const container = document.querySelector<HTMLElement>('.raw_message_text');
    if (container) {
        return container.innerText || container.textContent || '';
    }

    // Attempt 2: Fall back to primary pre block
    const pre = document.querySelector<HTMLElement>('pre');
    if (pre) {
        return pre.innerText || pre.textContent || '';
    }

    // Attempt 3: Try to find any message table that contains typical headers
    const mainBody = document.querySelector<HTMLElement>('table.message');
    if (mainBody) {
        // Find text content that looks like raw email
        return mainBody.innerText || mainBody.textContent || '';
    }

    return null;
}

/**
 * Parses raw MIME string into ExtendedEmailData structure.
 * This is a lightweight parser conforming to memory thresholds.
 */
function parseMimeData(rawText: string): ExtendedEmailData {
    const lines = rawText.split('\n');
    const headers: Record<string, string> = {};
    let rawBody = '';

    let isHeaderSection = true;
    let currentHeaderKey: string | null = null;
    let currentHeaderValue = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (isHeaderSection) {
            // Empty line marks end of headers
            if (line.trim() === '') {
                if (currentHeaderKey) {
                    headers[currentHeaderKey] = currentHeaderValue.trim();
                }
                isHeaderSection = false;
                continue;
            }

            // Processing folded headers (start with whitespace)
            if (line.match(/^\s/)) {
                if (currentHeaderKey) {
                    currentHeaderValue += ' ' + line.trim();
                }
            } else {
                // New header line
                const separatorIndex = line.indexOf(':');
                if (separatorIndex > 0) {
                    // Flush previous
                    if (currentHeaderKey) {
                        headers[currentHeaderKey] = currentHeaderValue.trim();
                    }

                    // Start new header
                    currentHeaderKey = line.substring(0, separatorIndex).trim().toLowerCase();
                    currentHeaderValue = line.substring(separatorIndex + 1).trim();
                } else {
                    // Could be malformed header or unexpected break, append to previous
                    if (currentHeaderKey) {
                        currentHeaderValue += ' ' + line.trim();
                    }
                }
            }
        } else {
            // Append to body after headers finish
            rawBody += line + '\n';
        }
    }

    // Fallback extraction from headers if available
    const fromStr = headers['from'] || '';

    // Parse 'To' and 'Cc' which could be comma-separated
    const parseEmails = (str: string) => {
        if (!str) return [];
        return str.split(',').map(e => e.trim()).filter(Boolean);
    };

    const toStrArray = parseEmails(headers['to']);
    const ccStrArray = parseEmails(headers['cc']);

    const subjectStr = headers['subject'] || '';
    const dateStr = headers['date'] || '';

    // Standard fallback mapping
    return {
        from: fromStr || '[extraction failed]',
        to: toStrArray.length > 0 ? toStrArray : ['[extraction failed]'],
        cc: ccStrArray,
        subject: subjectStr,
        date: dateStr,
        bodyText: '', // Will remain empty since parsing raw MIME body perfectly is out of scope
        extractionTimestamp: new Date().toISOString(),
        headers,
        rawBody,
    };
}


/**
 * Main extraction function for original view.
 */
export function extractOriginalContent(): ExtractionResult {
    const warnings: string[] = [];

    const rawText = extractRawText();

    if (!rawText) {
        return {
            success: false,
            warnings: ['Could not find raw email payload in the DOM via standard selectors.'],
            source: '[unknown source]',
            extractionSource: 'original',
            data: {
                from: '[extraction failed]',
                to: ['[extraction failed]'],
                cc: [],
                subject: '',
                date: '',
                bodyText: '',
                extractionTimestamp: new Date().toISOString(),
                headers: {},
                rawBody: ''
            } as ExtendedEmailData
        }
    }

    const rawSize = new Blob([rawText]).size;
    const parsedData = parseMimeData(rawText);

    if (parsedData.from === '[extraction failed]' || parsedData.to[0] === '[extraction failed]' || !parsedData.date) {
        warnings.push('Incomplete parsing of required primary headers from raw text.');
    }

    // Determine success
    const success =
        parsedData.from !== '[extraction failed]' &&
        !(parsedData.to.length === 1 && parsedData.to[0] === '[extraction failed]') &&
        parsedData.date !== '';

    let sourceVal = parsedData.subject || parsedData.from;
    if (!sourceVal || sourceVal === '[extraction failed]') {
        sourceVal = '[unknown source]';
    }

    return {
        success,
        warnings,
        source: sourceVal,
        extractionSource: 'original',
        data: parsedData,
        rawSize
    };
}
