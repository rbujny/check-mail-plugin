
export function decodeQuotedPrintable(input: string): string {
    if (!input) return '';

    let processed = input.replace(/=\r?\n/g, '');

    const bytes: number[] = [];
    for (let i = 0; i < processed.length; i++) {
        if (processed[i] === '=' && i + 2 < processed.length) {
            const hex = processed.substring(i + 1, i + 3);
            if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
                bytes.push(parseInt(hex, 16));
                i += 2;
                continue;
            }
        }
        bytes.push(processed.charCodeAt(i) & 0xFF);
    }

    try {
        const uint8Array = new Uint8Array(bytes);
        const decoder = new TextDecoder('utf-8', { fatal: false });
        return decoder.decode(uint8Array);
    } catch (e) {
        return input;
    }
}

export function stripHtml(input: string): string {
    if (!input) return '';

    let text = input;

    text = text.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, '');

    text = text.replace(/<[^>]+>/g, ' ');

    text = text.replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    text = text.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

    text = text.replace(/[ \t\r\n]+/g, ' ').trim();

    return text;
}
