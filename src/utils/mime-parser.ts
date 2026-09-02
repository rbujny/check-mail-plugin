
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

    const chunks = rawBody.split(/(?:\r?\n|^)--(?=[a-zA-Z0-9'()+_,-./:=?]+)/);

    if (chunks.length <= 1) {
        const match = rawBody.match(/^([\s\S]*?)\r?\n\r?\n([\s\S]*)$/i);
        if (!match) {
            if (/^Received:/i.test(rawBody) || /^Return-Path:/i.test(rawBody) || /^MIME-Version:/i.test(rawBody)) {
                return '';
            }
            return stripLeadingChunkSize(rawBody);
        }

        return stripLeadingChunkSize(match[2]);
    }

    const parts: { content: string, isHtml: boolean }[] = [];

    for (const chunk of chunks) {
        const cleanChunk = chunk.replace(/^\s+/, '');

        const match = cleanChunk.match(/^([\s\S]*?)\r?\n\r?\n([\s\S]*)$/i);
        if (!match) continue;

        const headers = match[1];
        let content = match[2];

        content = content.replace(/\r?\n--$/, '');

        const typeMatch = headers.match(/Content-Type:\s*text\/(html|plain)/i);
        if (typeMatch) {
            parts.push({
                content,
                isHtml: typeMatch[1].toLowerCase() === 'html'
            });
        }
    }

    if (parts.length === 0) {
        const match = rawBody.match(/^([\s\S]*?)\r?\n\r?\n([\s\S]*)$/i);
        if (!match) {
            if (/^Received:/i.test(rawBody) || /^Return-Path:/i.test(rawBody) || /^MIME-Version:/i.test(rawBody)) {
                return '';
            }
            return stripLeadingChunkSize(rawBody);
        }

        return stripLeadingChunkSize(match[2]);
    }

    const bestPart = parts.find(p => p.isHtml) || parts[0];

    return stripLeadingChunkSize(bestPart.content);
}
