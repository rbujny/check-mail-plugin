
function decodeBytes(bytes: Uint8Array, charset: string): string {
    try {
        return new TextDecoder(charset, { fatal: false }).decode(bytes);
    } catch (e) {
        return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    }
}

export function decodeQuotedPrintable(input: string, charset: string = 'utf-8'): string {
    if (!input) return '';

    let processed = input.replace(/=\r?\n/g, '');

    const encoder = new TextEncoder();
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
        const codePoint = processed.codePointAt(i) ?? 0;
        if (codePoint < 0x80) {
            bytes.push(codePoint);
        } else {
            bytes.push(...encoder.encode(String.fromCodePoint(codePoint)));
            if (codePoint > 0xFFFF) i++;
        }
    }

    return decodeBytes(new Uint8Array(bytes), charset);
}

export function decodeBase64(input: string, charset: string = 'utf-8'): string {
    if (!input) return '';

    try {
        const binary = atob(input.replace(/[^A-Za-z0-9+/=]/g, ''));
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        return decodeBytes(bytes, charset);
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
