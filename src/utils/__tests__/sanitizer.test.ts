import { describe, it, expect } from 'vitest';
import { decodeBase64, decodeQuotedPrintable, stripHtml } from '../sanitizer';

describe('decodeQuotedPrintable', () => {
    it('should remove soft line breaks', () => {
        const input = 'This is a very long line that was =\r\nbroken into two by Quoted-Printable =\nencoding.';
        const expected = 'This is a very long line that was broken into two by Quoted-Printable encoding.';
        expect(decodeQuotedPrintable(input)).toBe(expected);
    });

    it('should decode =XX hex sequences for ASCII characters', () => {
        const input = 'This is an equals sign: =3D';
        const expected = 'This is an equals sign: =';
        expect(decodeQuotedPrintable(input)).toBe(expected);
    });

    it('should decode =XX hex sequences for UTF-8 characters (Polish diacritics)', () => {
        const input = 'Za=C5=BC=C3=B3=C5=82=C4=87 g=C4=99=C5=9Bl=C4=85 ja=C5=BA=C5=84';
        const expected = 'Zażółć gęślą jaźń';
        expect(decodeQuotedPrintable(input)).toBe(expected);
    });

    it('should handle both soft breaks and hex encoding simultaneously', () => {
        const input = 'Cze=C5=9B=\r\n=C4=87';
        const expected = 'Cześć';
        expect(decodeQuotedPrintable(input)).toBe(expected);
    });

    it('should handle empty or null input gracefully', () => {
        expect(decodeQuotedPrintable('')).toBe('');
    });

    it('should not fail on malformed hex sequences', () => {
        const input = "Invalid sequence =ZZ";
        expect(decodeQuotedPrintable(input)).toBe("Invalid sequence =ZZ");
    });

    it('should preserve characters that were already decoded by the webmail view', () => {
        const input = 'Zażółć gęślą jaźń =3D 🙂';
        expect(decodeQuotedPrintable(input)).toBe('Zażółć gęślą jaźń = 🙂');
    });

    it('should decode bytes using the declared charset (ISO-8859-2)', () => {
        const input = 'Za=BF=F3=B3=E6';
        expect(decodeQuotedPrintable(input, 'iso-8859-2')).toBe('Zażółć');
    });

    it('should fall back to UTF-8 for an unknown charset label', () => {
        const input = 'Za=C5=BC=C3=B3=C5=82=C4=87';
        expect(decodeQuotedPrintable(input, 'x-unknown-charset')).toBe('Zażółć');
    });
});

describe('decodeBase64', () => {
    it('should decode UTF-8 text split into several lines', () => {
        const encoded = Buffer.from('Zażółć gęślą jaźń https://example.com', 'utf-8').toString('base64');
        const wrapped = encoded.replace(/(.{16})/g, '$1\r\n');
        expect(decodeBase64(wrapped)).toBe('Zażółć gęślą jaźń https://example.com');
    });

    it('should decode bytes using the declared charset (ISO-8859-2)', () => {
        const encoded = Buffer.from([0x5A, 0x61, 0xBF, 0xF3, 0xB3, 0xE6]).toString('base64');
        expect(decodeBase64(encoded, 'iso-8859-2')).toBe('Zażółć');
    });

    it('should return the input unchanged when it is not valid Base64', () => {
        expect(decodeBase64('x')).toBe('x');
    });

    it('should handle empty input gracefully', () => {
        expect(decodeBase64('')).toBe('');
    });
});

describe('stripHtml', () => {
    it('should completely remove <style> tags and their contents', () => {
        const input = '<style>\n  .p-margin { margin: 0; }\n  body { color: black; }\n</style>Hello World!';
        const expected = 'Hello World!';
        expect(stripHtml(input)).toBe(expected);
    });

    it('should replace HTML tags with spaces to prevent word concatenation', () => {
        const input = '<p>First paragraph</p><p>Second paragraph</p><div>Third</div>';
        const expected = 'First paragraph Second paragraph Third';
        expect(stripHtml(input)).toBe(expected);
    });

    it('should decode common HTML entities', () => {
        const input = 'This &amp; that &lt; is &gt; the &quot;truth&quot; &amp; that&#39;s it.&nbsp;Space';
        const expected = 'This & that < is > the "truth" & that\'s it. Space';
        expect(stripHtml(input)).toBe(expected);
    });

    it('should decode advanced numeric decimal and hexadecimal HTML entities', () => {
        const input = 'WordA&#8202;WordB&#x20;WordC&#x21;';
        const expected = `WordA\u200AWordB WordC!`.trim();
        expect(stripHtml(input)).toBe(expected);
    });

    it('should normalize excessive whitespace', () => {
        const input = '  <br>   Hello   <p>   World   </p>  ';
        const expected = 'Hello World';
        expect(stripHtml(input)).toBe(expected);
    });

    it('should handle empty or null input gracefully', () => {
        expect(stripHtml('')).toBe('');
    });
});
