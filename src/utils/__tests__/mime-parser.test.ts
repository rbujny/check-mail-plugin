import { describe, it, expect } from 'vitest';
import { extractBodyFromMime, extractDecodedBody } from '../mime-parser';

describe('extractBodyFromMime', () => {
    it('should extract text/html part from multipart/alternative', () => {
        const mimeStr = `Content-Type: multipart/alternative; boundary="boundary123"

--boundary123
Content-Type: text/plain; charset="utf-8"

Plain text body
--boundary123
Content-Type: text/html; charset="utf-8"

<html><body>HTML body</body></html>
--boundary123--`;

        const result = extractBodyFromMime(mimeStr);
        expect(result).toContain('<html><body>HTML body</body></html>');
        expect(result).not.toContain('Plain text body');
        expect(result).not.toContain('Content-Type:');
    });

    it('should fallback to plain text if no html part exists', () => {
        const mimeStr = `
--boundary123
Content-Type: text/plain; charset="utf-8"

Plain text body
--boundary123--`;

        const result = extractBodyFromMime(mimeStr);
        expect(result).toContain('Plain text body');
    });

    it('should handle non-multipart bodies with top level headers', () => {
        const mimeStr = `Content-Type: text/plain
Date: Today

Just the body here.`;
        const result = extractBodyFromMime(mimeStr);
        expect(result).toBe('Just the body here.');
    });

    it('should remove leading chunked transfer encoding limits (e.g. 96\\r\\n)', () => {
        const mimeStr = `Content-Type: text/plain
Date: Today

96
Just the body here.`;
        const result = extractBodyFromMime(mimeStr);
        expect(result).toBe('Just the body here.');
    });

    it('should remove leading chunk length inside multipart strings', () => {
        const mimeStr = `
--subboundary123
Content-Type: text/plain; charset="utf-8"

1a4b
Plain text body
--subboundary123--`;
        const result = extractBodyFromMime(mimeStr);
        expect(result).toBe('Plain text body');
    });

    it('should return raw body if parsing fails entirely', () => {
        const mimeStr = `Just some random text without any MIME structure.`;
        const result = extractBodyFromMime(mimeStr);
        expect(result).toBe(mimeStr);
    });
});

describe('extractDecodedBody', () => {
    it('should decode a Base64 text/html part of a multipart message', () => {
        const html = '<html><body>Zażółć <a href="https://evil.example/login?id=AB12">link</a></body></html>';
        const encoded = Buffer.from(html, 'utf-8').toString('base64');
        const source = `From: alice@example.com
Content-Type: multipart/alternative; boundary="b1"

--b1
Content-Type: text/plain; charset="utf-8"
Content-Transfer-Encoding: 7bit

Plain text body
--b1
Content-Type: text/html; charset="utf-8"
Content-Transfer-Encoding: base64

${encoded}
--b1--`;

        expect(extractDecodedBody(source)).toBe(html);
    });

    it('should decode Quoted-Printable using a folded ISO-8859-2 charset parameter', () => {
        const source = `Content-Type: multipart/alternative; boundary="b2"

--b2
Content-Type: text/plain;
\tcharset="ISO-8859-2"
Content-Transfer-Encoding: quoted-printable

Za=BF=F3=B3=E6 g=EA=B6l=B1 ja=BC=F1
--b2--`;

        expect(extractDecodedBody(source)).toBe('Zażółć gęślą jaźń');
    });

    it('should not apply Quoted-Printable decoding to 8bit parts', () => {
        const source = `Content-Type: text/html; charset=utf-8
Content-Transfer-Encoding: 8bit

<a href="https://example.com/?id=AB12">Zażółć</a>`;

        expect(extractDecodedBody(source)).toBe('<a href="https://example.com/?id=AB12">Zażółć</a>');
    });

    it('should leave content unchanged when no transfer encoding is declared', () => {
        const source = `Content-Type: text/plain

a=3Db`;

        expect(extractDecodedBody(source)).toBe('a=3Db');
    });

    it('should use top-level headers for a single-part body without its own header block', () => {
        const text = 'Dear user,\n\nPlease verify your account.';
        const encoded = Buffer.from(text, 'utf-8').toString('base64');

        const result = extractDecodedBody(encoded, {
            'content-type': 'text/plain; charset="UTF-8"',
            'content-transfer-encoding': 'base64',
        });

        expect(result).toBe(text);
    });

    it('should keep the first paragraph of a single-part body when top-level headers are given', () => {
        const result = extractDecodedBody('Dear user,\n\nClick =3D here', {
            'content-transfer-encoding': 'quoted-printable',
        });

        expect(result).toBe('Dear user,\n\nClick = here');
    });

    it('should return an empty string for empty input', () => {
        expect(extractDecodedBody('')).toBe('');
    });
});
