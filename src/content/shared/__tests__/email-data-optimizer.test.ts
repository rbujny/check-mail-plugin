
import { describe, it, expect } from 'vitest';
import {
    optimizeHeaders,
    parseSecurityVerdicts,
    optimizeBody,
    optimizeEmailData,
} from '../email-data-optimizer';

describe('optimizeHeaders', () => {
    it('should retain only allowed targeting headers (to, from, subject, reply-to, return-path)', () => {
        const raw: Record<string, string | string[]> = {
            'From': 'alice@example.com',
            'To': 'bob@example.com',
            'Subject': 'Test email',
            'Reply-To': 'alice-reply@example.com',
            'Return-Path': '<alice@example.com>',
            'Date': 'Mon, 9 Mar 2026 12:00:00 +0100',
            'Message-ID': '<abc@example.com>',
            'X-Mailer': 'TestMailer',
        };

        const { headers } = optimizeHeaders(raw);

        expect(headers).toHaveProperty('from');
        expect(headers).toHaveProperty('to');
        expect(headers).toHaveProperty('subject');
        expect(headers).toHaveProperty('reply-to');
        expect(headers).toHaveProperty('return-path');
        expect(headers).not.toHaveProperty('date');
        expect(headers).not.toHaveProperty('message-id');
        expect(headers).not.toHaveProperty('x-mailer');
    });

    it('should normalize header keys to lowercase', () => {
        const raw: Record<string, string | string[]> = {
            'FROM': 'alice@example.com',
            'TO': 'bob@example.com',
            'SUBJECT': 'Hello',
        };

        const { headers } = optimizeHeaders(raw);

        expect(Object.keys(headers).every(k => k === k.toLowerCase())).toBe(true);
        expect(headers['from']).toBe('alice@example.com');
    });

    it('should strip cryptographic signature headers (arc-seal, dkim-signature)', () => {
        const raw: Record<string, string | string[]> = {
            'From': 'alice@example.com',
            'To': 'bob@example.com',
            'Subject': 'Test',
            'ARC-Seal': 'i=1; a=rsa-sha256; d=google.com; s=arc-20160816; ... long signature ...',
            'ARC-Message-Signature': 'i=1; a=rsa-sha256; c=relaxed/relaxed; ... another long signature ...',
            'ARC-Authentication-Results': 'i=1; mx.google.com; ...',
            'DKIM-Signature': 'v=1; a=rsa-sha256; c=relaxed/relaxed; d=example.com; ... signature data ...',
        };

        const { headers } = optimizeHeaders(raw);

        expect(headers).not.toHaveProperty('arc-seal');
        expect(headers).not.toHaveProperty('arc-message-signature');
        expect(headers).not.toHaveProperty('arc-authentication-results');
        expect(headers).not.toHaveProperty('dkim-signature');
        expect(headers).toHaveProperty('from');
        expect(headers).toHaveProperty('to');
        expect(headers).toHaveProperty('subject');
    });

    it('should accumulate multiple Received headers from string[] input', () => {
        const raw: Record<string, string | string[]> = {
            'From': 'alice@example.com',
            'To': 'bob@example.com',
            'Received': [
                'from mx1.example.com by mx2.example.com',
                'from mx0.origin.com by mx1.example.com',
                'from sender.local by mx0.origin.com',
            ],
        };

        const { receivedChain } = optimizeHeaders(raw);

        expect(receivedChain).toHaveLength(3);
        expect(receivedChain[0]).toContain('mx1.example.com');
        expect(receivedChain[1]).toContain('mx0.origin.com');
        expect(receivedChain[2]).toContain('sender.local');
    });

    it('should handle a single Received header (string, not array)', () => {
        const raw: Record<string, string | string[]> = {
            'From': 'alice@example.com',
            'Received': 'from mx1.example.com by mx2.example.com',
        };

        const { receivedChain } = optimizeHeaders(raw);

        expect(receivedChain).toHaveLength(1);
        expect(receivedChain[0]).toContain('mx1.example.com');
    });

    it('should extract authentication-results regardless of casing', () => {
        const raw: Record<string, string | string[]> = {
            'From': 'alice@example.com',
            'authentication-Results': 'mx.google.com; spf=pass; dkim=pass; dmarc=pass',
        };

        const { authResultsRaw } = optimizeHeaders(raw);

        expect(authResultsRaw).toContain('spf=pass');
    });

    it('should retain Return-Path for spoofing detection', () => {
        const raw: Record<string, string | string[]> = {
            'From': 'display@legit.com',
            'Return-Path': '<actual-sender@suspicious.com>',
        };

        const { headers } = optimizeHeaders(raw);

        expect(headers['return-path']).toBe('<actual-sender@suspicious.com>');
    });
    it('should concatenate duplicate targeting headers instead of overwriting (Header Smuggling)', () => {
        const raw: Record<string, string | string[]> = {
            'From': 'alice@example.com',
            'Subject': ['Innocent Subject', 'URGENT: WINNER WINNER CHICKEN DINNER'],
        };

        const { headers } = optimizeHeaders(raw);

        expect(headers['subject']).toBe('Innocent Subject | URGENT: WINNER WINNER CHICKEN DINNER');
    });

    it('should properly merge multiple distinct Authentication-Results headers', () => {
        const raw: Record<string, string | string[]> = {
            'From': 'alice@example.com',
            'Authentication-Results': [
                'mx1.spam.com; dkim=fail',
                'mx2.google.com; spf=pass; dkim=pass; dmarc=none'
            ],
        };

        const { authResultsRaw } = optimizeHeaders(raw);
        const verdicts = parseSecurityVerdicts(authResultsRaw);

        expect(authResultsRaw).toContain('mx1.spam.com; dkim=fail');
        expect(authResultsRaw).toContain('mx2.google.com; spf=pass; dkim=pass; dmarc=none');

        expect(verdicts.spf).toBe('pass');
    });
});

describe('parseSecurityVerdicts', () => {
    it('should parse SPF, DKIM, and DMARC verdicts from authentication-results', () => {
        const authResults =
            'mx.google.com; dkim=pass header.i=@example.com; spf=pass (google.com: domain); dmarc=pass';

        const verdicts = parseSecurityVerdicts(authResults);

        expect(verdicts.spf).toBe('pass');
        expect(verdicts.dkim).toBe('pass');
        expect(verdicts.dmarc).toBe('pass');
    });

    it('should handle "fail" and "softfail" verdicts', () => {
        const authResults =
            'mx.google.com; spf=softfail; dkim=fail; dmarc=fail';

        const verdicts = parseSecurityVerdicts(authResults);

        expect(verdicts.spf).toBe('softfail');
        expect(verdicts.dkim).toBe('fail');
        expect(verdicts.dmarc).toBe('fail');
    });

    it('should handle "none" verdicts', () => {
        const authResults =
            'mx.google.com; spf=none; dkim=none; dmarc=none';

        const verdicts = parseSecurityVerdicts(authResults);

        expect(verdicts.spf).toBe('none');
        expect(verdicts.dkim).toBe('none');
        expect(verdicts.dmarc).toBe('none');
    });

    it('should return empty object for empty header string', () => {
        const verdicts = parseSecurityVerdicts('');
        expect(verdicts).toEqual({});
    });
});

describe('optimizeBody', () => {
    it('should extract http and https URLs from body text', () => {
        const body =
            'Visit https://example.com for info, or check http://test.org/page for more.';

        const { links } = optimizeBody(body);

        expect(links).toContain('https://example.com');
        expect(links).toContain('http://test.org/page');
        expect(links).toHaveLength(2);
    });

    it('should deduplicate URLs', () => {
        const body =
            'Visit https://example.com and also https://example.com again.';

        const { links } = optimizeBody(body);

        expect(links).toHaveLength(1);
        expect(links[0]).toBe('https://example.com');
    });

    it('should replace all URLs with [LINK] placeholder', () => {
        const body =
            'Click https://example.com to proceed.';

        const { body: processed } = optimizeBody(body);

        expect(processed).not.toContain('https://example.com');
        expect(processed).toContain('[LINK]');
    });

    it('should extract mailto: links used for phishing reply vectors', () => {
        const body =
            'Reply to mailto:phisher@evil.com or click https://safe.com for help.';

        const { links } = optimizeBody(body);

        expect(links).toContain('mailto:phisher@evil.com');
        expect(links).toContain('https://safe.com');
        expect(links).toHaveLength(2);
    });

    it('should extract data: URIs used for payload injection', () => {
        const body =
            'Open this link: data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==';

        const { links } = optimizeBody(body);

        expect(links).toHaveLength(1);
        expect(links[0]).toContain('data:text/html;base64,');
    });

    it('should normalize whitespace (multiple spaces, newlines, tabs)', () => {
        const body = 'Hello   world.\n\n\nThis   is\t\ta   test.';

        const { body: processed } = optimizeBody(body);

        expect(processed).toBe('Hello world. This is a test.');
    });

    it('should truncate body to maximum 1000 characters with [TRUNCATED] marker', () => {
        const body = 'A'.repeat(2000);

        const { body: processed, truncated } = optimizeBody(body);

        expect(processed.length).toBeLessThanOrEqual(1000);
        expect(processed).toMatch(/\[TRUNCATED\]$/);
        expect(truncated).toBe(true);
    });

    it('should not truncate body shorter than 1000 characters', () => {
        const body = 'Short body text.';

        const { body: processed, truncated } = optimizeBody(body);

        expect(processed).toBe('Short body text.');
        expect(truncated).toBe(false);
    });

    it('should return empty body and links for empty input', () => {
        const { body, links, truncated } = optimizeBody('');

        expect(body).toBe('');
        expect(links).toEqual([]);
        expect(truncated).toBe(false);
    });

    it('should cap the list of extracted URLs to 50 to prevent payload DoS attacks', () => {
        let largeBody = '';
        for (let i = 0; i < 60; i++) {
            largeBody += `https://example.com/page${i} `;
        }

        const { links, truncated } = optimizeBody(largeBody);

        expect(links).toHaveLength(50);
        expect(links).not.toContain('https://example.com/page59');
        expect(truncated).toBe(false);
    });

    it('should cap extremely long URLs to 2048 characters to prevent URL-stuffing DoS', () => {
        const giantUrl = 'https://example.com/' + 'A'.repeat(5000);
        const { links, truncated } = optimizeBody('Click ' + giantUrl);

        expect(links).toHaveLength(1);
        expect(links[0].length).toBe(2048 + 3);
        expect(links[0].endsWith('...')).toBe(true);
        expect(truncated).toBe(false);
    });
});

describe('Edge Cases', () => {
    it('should handle auth-results with only SPF (no DKIM or DMARC)', () => {
        const authResults = 'mx.google.com; spf=pass';

        const verdicts = parseSecurityVerdicts(authResults);

        expect(verdicts.spf).toBe('pass');
        expect(verdicts.dkim).toBeUndefined();
        expect(verdicts.dmarc).toBeUndefined();
    });

    it('should handle completely malformed auth-results gracefully', () => {
        const authResults = 'this is not a valid authentication-results header at all';

        const verdicts = parseSecurityVerdicts(authResults);

        expect(verdicts).toBeDefined();
    });

    it('should handle body composed entirely of URLs', () => {
        const body =
            'https://example.com https://test.org http://another.com/path';

        const { body: processed, links } = optimizeBody(body);

        expect(links).toHaveLength(3);
        expect(processed).toBe('[LINK] [LINK] [LINK]');
    });

    it('should handle URLs that stop at common delimiters', () => {
        const body = 'Check <https://example.com> for info.';

        const { links } = optimizeBody(body);

        expect(links).toHaveLength(1);
        expect(links[0]).toBe('https://example.com');
    });

    it('should handle URLs adjacent to parentheses', () => {
        const body = 'See (https://example.com/path) for more.';

        const { links } = optimizeBody(body);

        expect(links).toHaveLength(1);
        expect(links[0]).toBe('https://example.com/path');
    });

    it('should handle missing Reply-To header gracefully', () => {
        const raw: Record<string, string | string[]> = {
            'From': 'alice@example.com',
            'To': 'bob@example.com',
            'Subject': 'Test',
        };

        const { headers } = optimizeHeaders(raw);

        expect(headers).toHaveProperty('from');
        expect(headers).toHaveProperty('to');
        expect(headers).toHaveProperty('subject');
        expect(headers).not.toHaveProperty('reply-to');
    });

    it('should handle missing To field gracefully', () => {
        const raw: Record<string, string | string[]> = {
            'From': 'alice@example.com',
            'Subject': 'Undisclosed recipients',
        };

        const { headers } = optimizeHeaders(raw);

        expect(headers).toHaveProperty('from');
        expect(headers).toHaveProperty('subject');
        expect(headers).not.toHaveProperty('to');
    });

    it('should handle completely empty headers input', () => {
        const { headers, receivedChain, authResultsRaw } = optimizeHeaders({});

        expect(Object.keys(headers)).toHaveLength(0);
        expect(receivedChain).toHaveLength(0);
        expect(authResultsRaw).toBe('');
    });
});

describe('optimizeEmailData (integration)', () => {
    const sampleHeaders: Record<string, string | string[]> = {
        'From': 'attacker@phish.com',
        'To': 'victim@company.com',
        'Subject': 'Urgent: Verify your account',
        'Reply-To': 'legit-looking@phish.com',
        'Return-Path': '<bounce@phish.com>',
        'Date': 'Mon, 9 Mar 2026 12:00:00 +0100',
        'Message-ID': '<abc123@phish.com>',
        'Received': [
            'from mx.phish.com by mx.company.com with ESMTPS id abc123',
            'from internal.phish.com by mx.phish.com with ESMTP id xyz789',
            'from sender.phish.com by internal.phish.com with SMTP id def456',
        ],
        'DKIM-Signature': 'v=1; a=rsa-sha256; c=relaxed/relaxed; d=phish.com; s=selector; h=from:to:subject:date:message-id:content-type; bh=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH=; b=VeryLongBase64SignatureDataThatIsTypicallyHundredsOfCharactersLongInRealWorldEmailsAndConsumesSignificantPayloadSpaceWhenTransmittedOverTheNetworkToTheBackendServiceForAnalysis0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
        'ARC-Seal': 'i=1; a=rsa-sha256; t=1709978400; cv=none; d=google.com; s=arc-20160816; b=AnotherVeryLongBase64EncodedSignatureThatIsTypicallyHundredsOfCharactersLongAndContainsTheActualCryptographicSealDataUsedToValidateTheARCChainOfTrust0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
        'ARC-Message-Signature': 'i=1; a=rsa-sha256; c=relaxed/relaxed; d=google.com; s=arc-20160816; h=from:to:subject; bh=aGFzaHZhbHVlYmFzZTY0ZW5jb2RlZA==; b=YetAnotherLongSignatureBase64DataThatConsumesPayloadSpace0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqr',
        'ARC-Authentication-Results': 'i=1; mx.google.com; dkim=pass header.i=@phish.com header.s=selector header.b=VeryLong; spf=pass smtp.helo=phish.com; dmarc=fail header.from=phish.com',
        'Authentication-Results': 'mx.company.com; spf=fail smtp.mailfrom=phish.com; dkim=pass header.i=@phish.com header.s=selector header.b=ABCDEFG; dmarc=fail header.from=phish.com policy=reject',
        'X-Spam-Status': 'Yes, score=8.5 required=5.0 tests=BAYES_99,DKIM_SIGNED,DKIM_VALID,HTML_MESSAGE autolearn=spam autolearn_force=no version=3.4.6',
        'X-Mailer': 'MassMailer Pro v2.3.1',
        'Content-Type': 'multipart/alternative; boundary="000000000000abcdef123456789"',
        'MIME-Version': '1.0',
    };

    const sampleBody = `
        Dear user,

        Your account has been compromised. Please click https://phish.com/reset
        to reset your password immediately. You can also visit
        https://phish.com/verify for verification.

        If you have questions, reply to mailto:support@phish.com or
        visit our support page at https://phish.com/reset.

        Best regards,
        Support Team
    `;

    it('should produce a complete ProcessedEmailData object', () => {
        const result = optimizeEmailData(sampleHeaders, sampleBody);

        expect(result.headers).toHaveProperty('from', 'attacker@phish.com');
        expect(result.headers).toHaveProperty('to', 'victim@company.com');
        expect(result.headers).toHaveProperty('subject', 'Urgent: Verify your account');
        expect(result.headers).toHaveProperty('reply-to', 'legit-looking@phish.com');
        expect(result.headers).toHaveProperty('return-path', '<bounce@phish.com>');
        expect(result.headers).not.toHaveProperty('date');
        expect(result.headers).not.toHaveProperty('message-id');
        expect(result.headers).not.toHaveProperty('dkim-signature');
        expect(result.headers).not.toHaveProperty('arc-seal');
        expect(result.headers).not.toHaveProperty('x-spam-status');
        expect(result.headers).not.toHaveProperty('content-type');

        expect(result.receivedChain).toHaveLength(3);

        expect(result.securityVerdicts.spf).toBe('fail');
        expect(result.securityVerdicts.dkim).toBe('pass');
        expect(result.securityVerdicts.dmarc).toBe('fail');

        expect(result.body).toContain('[LINK]');
        expect(result.body).not.toContain('https://phish.com');
        expect(result.body).not.toContain('mailto:');
        expect(result.body.length).toBeLessThanOrEqual(1000);

        expect(result.links).toContain('https://phish.com/reset');
        expect(result.links).toContain('https://phish.com/verify');
        expect(result.links).toContain('mailto:support@phish.com');
        expect(result.links.filter(l => l === 'https://phish.com/reset')).toHaveLength(1);
    });

    it('should extract auth-results regardless of header key casing', () => {
        const mixedCaseHeaders: Record<string, string | string[]> = {
            'From': 'test@example.com',
            'authentication-RESULTS': 'mx.example.com; spf=pass; dkim=fail; dmarc=none',
        };

        const result = optimizeEmailData(mixedCaseHeaders, 'test body');

        expect(result.securityVerdicts.spf).toBe('pass');
        expect(result.securityVerdicts.dkim).toBe('fail');
        expect(result.securityVerdicts.dmarc).toBe('none');
    });

    it('should append [TRUNCATED] marker when body exceeds 1000 chars', () => {
        const longBody = 'Word '.repeat(500);

        const result = optimizeEmailData({ 'From': 'test@test.com' }, longBody);

        expect(result.truncated).toBe(true);
        expect(result.body).toMatch(/\[TRUNCATED\]$/);
        expect(result.body.length).toBeLessThanOrEqual(1000);
    });

    it('should set truncated to false for short bodies', () => {
        const result = optimizeEmailData({ 'From': 'test@test.com' }, 'Short body.');

        expect(result.truncated).toBe(false);
        expect(result.body).not.toContain('[TRUNCATED]');
    });

    it('should reduce payload size by at least 50% compared to raw input (SC-001)', () => {
        const rawSize = JSON.stringify({ headers: sampleHeaders, body: sampleBody }).length;
        const result = optimizeEmailData(sampleHeaders, sampleBody);
        const optimizedSize = JSON.stringify(result).length;

        const reductionPercent = ((rawSize - optimizedSize) / rawSize) * 100;
        expect(reductionPercent).toBeGreaterThanOrEqual(50);
    });

    it('should complete extraction in under 50ms (SC-004)', () => {
        const largeBody = ('Hello https://example.com/page ' + 'A'.repeat(100) + '\n').repeat(100);

        const start = performance.now();
        optimizeEmailData(sampleHeaders, largeBody);
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(50);
    });
});
