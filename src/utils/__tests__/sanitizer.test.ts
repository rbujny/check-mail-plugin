import { describe, it, expect } from 'vitest';
import { decodeQuotedPrintable, stripHtml } from '../sanitizer';

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
        // "Zażółć gęślą jaźń"
        const input = 'Za=C5=BC=C3=B3=C5=82=C4=87 g=C4=99=C5=9Bl=C4=85 ja=C5=BA=C5=84';
        const expected = 'Zażółć gęślą jaźń';
        expect(decodeQuotedPrintable(input)).toBe(expected);
    });

    it('should handle both soft breaks and hex encoding simultaneously', () => {
        const input = 'Cze=C5=9B=\r\n=C4=87'; // "Cześć" broken mid-word
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
        // &#8202; is Hair Space, &#x20; is Space, &#x21; is Exclamation
        const input = 'WordA&#8202;WordB&#x20;WordC&#x21;';
        const expected = `WordA\u200AWordB WordC!`.trim();
        expect(stripHtml(input)).toBe(expected);
    });

    it('should normalize excessive whitespace', () => {
        // Include new hair space parsing in the normalization flow
        const input = '  <br>   Hello   <p>   World   </p>  ';
        const expected = 'Hello World';
        expect(stripHtml(input)).toBe(expected);
    });

    it('should handle empty or null input gracefully', () => {
        expect(stripHtml('')).toBe('');
    });
});
