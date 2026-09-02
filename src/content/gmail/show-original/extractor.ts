
import type { ExtractionResult, ExtendedEmailData } from '../../../types/email';

function extractRawText(): string | null {
    const container = document.querySelector<HTMLElement>('.raw_message_text');
    if (container) {
        return container.innerText || container.textContent || '';
    }

    const pre = document.querySelector<HTMLElement>('pre');
    if (pre) {
        return pre.innerText || pre.textContent || '';
    }

    const mainBody = document.querySelector<HTMLElement>('table.message');
    if (mainBody) {
        return mainBody.innerText || mainBody.textContent || '';
    }

    return null;
}

export function parseMimeData(rawText: string): ExtendedEmailData {
    const lines = rawText.split('\n');
    const headers: Record<string, string | string[]> = {};
    let rawBody = '';

    let isHeaderSection = true;
    let currentHeaderKey: string | null = null;
    let currentHeaderValue = '';

    function flushHeader(): void {
        if (!currentHeaderKey) return;
        const val = currentHeaderValue.trim();
        const existing = headers[currentHeaderKey];

        if (existing === undefined) {
            headers[currentHeaderKey] = val;
        } else if (Array.isArray(existing)) {
            existing.push(val);
        } else {
            headers[currentHeaderKey] = [existing, val];
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (isHeaderSection) {
            if (line.trim() === '') {
                flushHeader();
                isHeaderSection = false;
                continue;
            }

            if (line.match(/^\s/)) {
                if (currentHeaderKey) {
                    currentHeaderValue += ' ' + line.trim();
                }
            } else {
                const separatorIndex = line.indexOf(':');
                if (separatorIndex > 0) {
                    flushHeader();

                    currentHeaderKey = line.substring(0, separatorIndex).trim().toLowerCase();
                    currentHeaderValue = line.substring(separatorIndex + 1).trim();
                } else {
                    if (currentHeaderKey) {
                        currentHeaderValue += ' ' + line.trim();
                    }
                }
            }
        } else {
            rawBody += line + '\n';
        }
    }

    const getFirst = (key: string): string => {
        const v = headers[key];
        if (!v) return '';
        return Array.isArray(v) ? v[0] : v;
    };

    const fromStr = getFirst('from');

    const parseEmails = (str: string) => {
        if (!str) return [];
        return str.split(',').map(e => e.trim()).filter(Boolean);
    };

    const toStrArray = parseEmails(getFirst('to'));
    const ccStrArray = parseEmails(getFirst('cc'));

    const subjectStr = getFirst('subject');
    const dateStr = getFirst('date');

    return {
        from: fromStr || '[extraction failed]',
        to: toStrArray.length > 0 ? toStrArray : ['[extraction failed]'],
        cc: ccStrArray,
        subject: subjectStr,
        date: dateStr,
        bodyText: '',
        extractionTimestamp: new Date().toISOString(),
        headers,
        rawBody,
    };
}

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
