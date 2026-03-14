/**
 * Utility functions for sanitizing raw email extracts.
 */

/**
 * Decodes Quoted-Printable encoded strings natively resolving UTF-8 bytes to fix Mojibake.
 * 
 * Quoted-Printable encoding uses:
 * 1. `=\r\n` or `=\n` as soft line breaks, which should be removed.
 * 2. `=XX` where XX is a hex code representing a byte.
 * 
 * @param input The raw Quoted-Printable encoded string
 * @returns The successfully decoded UTF-8 string
 */
export function decodeQuotedPrintable(input: string): string {
    if (!input) return '';

    // Step 1: Remove soft line breaks (an equals sign followed immediately by CRLF or LF)
    let processed = input.replace(/=\r?\n/g, '');

    // Step 2: Convert sequence safely into a byte array
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
        // Normal characters (Latin1 range interpreted back to bytes)
        bytes.push(processed.charCodeAt(i) & 0xFF);
    }

    // Step 3: Decode raw bytes via true UTF-8 Decoder
    try {
        const uint8Array = new Uint8Array(bytes);
        // fatal: false forces replacement character for malformed bytes instead of crashing
        const decoder = new TextDecoder('utf-8', { fatal: false });
        return decoder.decode(uint8Array);
    } catch (e) {
        return input; // Absolute fallback
    }
}

/**
 * Strips HTML tags and contents of specific elements like <style> and <script>.
 * Replaces normal HTML tags with spaces to prevent adjacent word concatenation.
 * 
 * @param input HTML string
 * @returns Plain text with HTML stripped
 */
export function stripHtml(input: string): string {
    if (!input) return '';

    let text = input;

    // Remove <style>...</style> and <script>...</script> blocks entirely including their content
    text = text.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, '');

    // Replace all other HTML tags with a space to prevent words from sticking together
    // e.g., <p>Hello</p><p>World</p> -> Hello World, not HelloWorld
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode common named HTML entities
    text = text.replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    // Decode numerical HTML entities (both decimal &#123; and hex &#x1A;)
    text = text.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

    // Clean up excessive standard whitespace resulting from tag replacements
    // Uses specific characters rather than \s to avoid nuking decoded unicode spaces (like Hair Space \u200A)
    text = text.replace(/[ \t\r\n]+/g, ' ').trim();

    return text;
}
