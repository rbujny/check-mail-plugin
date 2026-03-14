import { describe, it, expect } from 'vitest';
import { extractBodyFromMime } from '../mime-parser';

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
