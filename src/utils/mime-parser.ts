/**
 * Basic MIME multipart parser to extract the body and strip part headers.
 */

/**
 * Extracts the best content part from a raw MIME string.
 * It searches for `\r\n\r\n` or `\n\n` immediately following `Content-Type: text/(html|plain)`
 * and captures the content until the next boundary `--`.
 */
function stripLeadingChunkSize(text: string): string {
    const trimmed = text.trimStart();
    const lines = trimmed.split(/\r?\n/);
    if (lines.length > 0 && /^[0-9A-Fa-f]+$/.test(lines[0].trim())) {
        lines.shift();
        return lines.join('\n');
    }
    return trimmed;
}

export function extractBodyFromMime(rawBody: string): string {
    if (!rawBody) return '';

    // Split by boundary strings (e.g., --BOUNDARY123)
    const chunks = rawBody.split(/(?:\r?\n|^)--(?=[a-zA-Z0-9'()+_,-./:=?]+)/);

    // If there were no boundaries, we might just have a plain email 
    // where top-level headers were already removed, leaving just content.
    // Or we have a single part email still containing top-level headers.
    if (chunks.length <= 1) {
        const match = rawBody.match(/^([\s\S]*?)\r?\n\r?\n([\s\S]*)$/i);
        if (!match) {
            if (/^Received:/i.test(rawBody) || /^Return-Path:/i.test(rawBody) || /^MIME-Version:/i.test(rawBody)) {
                return ''; // It's just a block of headers
            }
            return stripLeadingChunkSize(rawBody);
        }

        // Remove trailing chunk length bleeding into the body by trimming initial newlines
        return stripLeadingChunkSize(match[2]);
    }

    const parts: { content: string, isHtml: boolean }[] = [];

    for (const chunk of chunks) {
        // Trim leading whitespace/newlines from chunk to allow clean regex match
        const cleanChunk = chunk.replace(/^\s+/, '');

        // Find the empty line separating headers from content in this chunk
        const match = cleanChunk.match(/^([\s\S]*?)\r?\n\r?\n([\s\S]*)$/i);
        if (!match) continue;

        const headers = match[1];
        let content = match[2];

        // Ensure we remove the trailing closing boundary suffix `--` if this was the last part
        content = content.replace(/\r?\n--$/, '');

        // Is it HTML or Plain text?
        const typeMatch = headers.match(/Content-Type:\s*text\/(html|plain)/i);
        if (typeMatch) {
            parts.push({
                content,
                isHtml: typeMatch[1].toLowerCase() === 'html'
            });
        }
    }

    if (parts.length === 0) {
        // Fallback: Just try to strip main headers from the first chunk 
        // if no explicit html/plain type matched
        const match = rawBody.match(/^([\s\S]*?)\r?\n\r?\n([\s\S]*)$/i);
        if (!match) {
            if (/^Received:/i.test(rawBody) || /^Return-Path:/i.test(rawBody) || /^MIME-Version:/i.test(rawBody)) {
                return ''; // It's just a block of headers
            }
            return stripLeadingChunkSize(rawBody);
        }

        // Remove trailing chunk length bleeding into the body by trimming initial newlines
        return stripLeadingChunkSize(match[2]);
    }

    // Prefer HTML over plain text
    const bestPart = parts.find(p => p.isHtml) || parts[0];

    // Remove chunked transfer encoding length indicators that sometimes bleed in
    // Format: hex string followed by CRLF at the very beginning of the payload
    return stripLeadingChunkSize(bestPart.content);
}
