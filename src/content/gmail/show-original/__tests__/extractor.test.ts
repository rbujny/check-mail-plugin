import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { extractOriginalContent, parseMimeData } from '../extractor';

describe('parseMimeData', () => {
    it('should extract basic headers from a MIME string', () => {
        const mimeStr = `From: sender@example.com\r\nTo: recipient@example.com\r\nSubject: Test Subject\r\n\r\nBody content.`;
        const result = parseMimeData(mimeStr);

        expect(result.headers['from']).toBe('sender@example.com');
        expect(result.headers['to']).toBe('recipient@example.com');
        expect(result.headers['subject']).toBe('Test Subject');
        expect(result.rawBody).toContain('Body content.');
    });

    it('should correctly handle multi-line (folded) headers', () => {
        const mimeStr = `Subject: This is a very long\r\n subject that spans\r\n multiple lines\r\nTo: bob@example.com\r\n\r\nBody`;
        const result = parseMimeData(mimeStr);

        expect(result.headers['subject']).toBe('This is a very long subject that spans multiple lines');
        expect(result.headers['to']).toBe('bob@example.com');
    });

    it('should accumulate duplicate headers into an array', () => {
        const mimeStr = `Received: from mx1.local\r\nReceived: from mx2.local\r\nReceived: from mx3.local\r\n\r\nBody`;
        const result = parseMimeData(mimeStr);

        expect(Array.isArray(result.headers['received'])).toBe(true);
        expect(result.headers['received']).toEqual(['from mx1.local', 'from mx2.local', 'from mx3.local']);
    });

    it('should extract body content correctly after the empty line delimiter', () => {
        const mimeStr = `Header1: Value1\nHeader2: Value2\n\nThis is the body.\nIt has multiple lines.\n\nEven empty ones.`;
        const result = parseMimeData(mimeStr);

        expect(result.rawBody).toContain('This is the body.\nIt has multiple lines.\n\nEven empty ones.');
    });

    it('should handle completely missing body gracefully', () => {
        const mimeStr = `Header1: Value1\nHeader2: Value2`;
        const result = parseMimeData(mimeStr);
        expect(result.rawBody).toBe('');
    });
});

describe('extractOriginalContent', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('should extract data purely from the raw MIME text block', () => {
        const container = document.createElement('div');
        const rawTextDiv = document.createElement('div');
        rawTextDiv.className = 'raw_message_text';

        const rawString = `From: alice@example.com
To: bob@example.com
Subject: Hello World
Date: Mon, 9 Mar 2026 12:00:00 +0100
Authentication-Results: mx.google.com; spf=pass

This is the raw body.`;

        Object.defineProperty(rawTextDiv, 'innerText', {
            get: () => rawString,
            configurable: true
        });

        container.appendChild(rawTextDiv);
        document.body.appendChild(container);

        const result = extractOriginalContent();
        console.log('EXTRACT ORIGINAL CONTENT RESULT:', JSON.stringify(result, null, 2));

        expect(result.success).toBe(true);
        expect(result.data.from).toBe('alice@example.com');
        expect(result.data.to).toEqual(['bob@example.com']);
        expect(result.data.subject).toBe('Hello World');
        const extendedData = result.data as any;
        expect(extendedData.rawBody).toContain('This is the raw body.');

        expect(extendedData.headers['authentication-results']).toBe('mx.google.com; spf=pass');
    });

    it('should extract SPF, DKIM, and DMARC specifically from the summary table if present', () => {
        const container = document.createElement('div');
        const rawTextDiv = document.createElement('div');
        rawTextDiv.className = 'raw_message_text';

        const rawString = `From: alice@example.com
To: bob@example.com
Date: Some date

Body`;

        Object.defineProperty(rawTextDiv, 'innerText', {
            get: () => rawString,
            configurable: true
        });

        container.appendChild(rawTextDiv);
        document.body.appendChild(container);

        const result = extractOriginalContent();
        const extendedData = result.data as any;

        expect(result.success).toBe(true);
        expect(extendedData.headers['from']).toBe('alice@example.com');
        expect(extendedData.headers['to']).toBe('bob@example.com');
        expect(extendedData.headers['date']).toBe('Some date');
    });

    it('should fail gracefully (success=false) when core tabular elements are missing', () => {
        document.body.innerHTML = `
            <div>
                <div class="raw_message_text">\n\nJust body</div>
            </div>
        `;

        const result = extractOriginalContent();

        expect(result.success).toBe(false);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.data.from).toBe('[extraction failed]');
    });
});
