
import { decodeBase64, decodeQuotedPrintable } from './sanitizer';

const PART_BOUNDARY = /(?:\r?\n|^)--(?=[a-zA-Z0-9'()+_,-./:=?]+)/;

const HEADERS_AND_CONTENT = /^([\s\S]*?)\r?\n\r?\n([\s\S]*)$/i;

interface MimePart {
    headers: string;
    content: string;
}

function stripLeadingChunkSize(text: string): string {
    const trimmed = text.trimStart();
    const lines = trimmed.split(/\r?\n/);
    if (lines.length > 0 && /^[0-9A-Fa-f]+$/.test(lines[0].trim())) {
        lines.shift();
        return lines.join('\n');
    }
    return trimmed;
}

function splitSinglePart(rawBody: string): MimePart | null {
    const match = rawBody.match(HEADERS_AND_CONTENT);
    if (!match) {
        if (/^Received:/i.test(rawBody) || /^Return-Path:/i.test(rawBody) || /^MIME-Version:/i.test(rawBody)) {
            return null;
        }
        return { headers: '', content: rawBody };
    }

    return { headers: match[1], content: match[2] };
}

function findTextPart(rawBody: string): MimePart | null {
    const chunks = rawBody.split(PART_BOUNDARY);

    if (chunks.length <= 1) {
        return null;
    }

    const parts: { part: MimePart, isHtml: boolean }[] = [];

    for (const chunk of chunks) {
        const cleanChunk = chunk.replace(/^\s+/, '');

        const match = cleanChunk.match(HEADERS_AND_CONTENT);
        if (!match) continue;

        const headers = match[1];
        const content = match[2].replace(/\r?\n--$/, '');

        const typeMatch = headers.match(/Content-Type:\s*text\/(html|plain)/i);
        if (typeMatch) {
            parts.push({
                part: { headers, content },
                isHtml: typeMatch[1].toLowerCase() === 'html'
            });
        }
    }

    if (parts.length === 0) {
        return null;
    }

    const bestPart = parts.find(p => p.isHtml) || parts[0];

    return bestPart.part;
}

function headersToBlock(headers: Record<string, string | string[]>): string {
    return Object.entries(headers)
        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value[0] : value}`)
        .join('\n');
}

function readPartEncoding(headers: string): { transferEncoding: string; charset: string } {
    const unfolded = headers.replace(/\r?\n[ \t]+/g, ' ');
    const transferEncoding = unfolded.match(/^content-transfer-encoding:\s*([^\s;]+)/im)?.[1].toLowerCase() || '';
    const charset = unfolded.match(/charset\s*=\s*"?([^";\s]+)/i)?.[1].toLowerCase() || 'utf-8';
    return { transferEncoding, charset };
}

export function extractBodyFromMime(rawBody: string): string {
    if (!rawBody) return '';

    const part = findTextPart(rawBody) || splitSinglePart(rawBody);

    return part ? stripLeadingChunkSize(part.content) : '';
}

export function extractDecodedBody(source: string, topLevelHeaders?: Record<string, string | string[]>): string {
    if (!source) return '';

    const part = findTextPart(source) || (topLevelHeaders
        ? { headers: headersToBlock(topLevelHeaders), content: source }
        : splitSinglePart(source));

    if (!part) return '';

    const content = stripLeadingChunkSize(part.content);
    const { transferEncoding, charset } = readPartEncoding(part.headers);

    if (transferEncoding === 'base64') {
        return decodeBase64(content, charset);
    }
    if (transferEncoding === 'quoted-printable') {
        return decodeQuotedPrintable(content, charset);
    }
    return content;
}
