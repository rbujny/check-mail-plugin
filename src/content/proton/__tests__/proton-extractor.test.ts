import { describe, it, expect, beforeEach, vi } from 'vitest';
import { extractProtonEmailContent, extractProtonRawContent, parseProtonHeaders } from '../proton-extractor';

// JSDOM doesn't implement innerText, so we mock it
if (!Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText')) {
    Object.defineProperty(HTMLElement.prototype, 'innerText', {
        get() { return this.textContent; },
        set(v) { this.textContent = v; },
        configurable: true,
    });
}

describe('proton-extractor', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('should extract basic email data from a standard ProtonMail message container', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <div data-testid="message-view">
                <header class="message-view-header">
                    <h1 class="message-subject">Urgent: Security Update</h1>
                    <div class="message-header-expanded">
                        <span class="message-sender" title="security@proton.me">Proton Security</span>
                        <span class="message-recipient" title="user@proton.me">Me</span>
                        <time class="message-date-time" title="March 16, 2026 4:00 PM">4:00 PM</time>
                    </div>
                </header>
                <div class="message-content">
                    <div id="message-body">
                        Please update your recovery email.
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(container);

        const result = extractProtonEmailContent(container);

        expect(result.success).toBe(true);
        expect(result.data.subject).toBe('Urgent: Security Update');
        expect(result.data.from).toBe('security@proton.me');
        expect(result.data.to).toContain('user@proton.me');
        expect(result.data.bodyText).toContain('Please update your recovery email.');
        expect(result.data.date).toBe('March 16, 2026 4:00 PM');
    });

    it('should handle multiple recipients', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <div data-testid="message-view">
                <div class="message-header-expanded">
                    <span class="message-sender" title="boss@work.com">Boss</span>
                    <span class="message-recipient" title="dev1@work.com">Dev 1</span>
                    <span class="message-recipient" title="dev2@work.com">Dev 2</span>
                </div>
            </div>
        `;
        const result = extractProtonEmailContent(container);
        expect(result.data.to).toEqual(['dev1@work.com', 'dev2@work.com']);
    });

    it('should extract raw content from the "Show headers" modal', () => {
        const modal = document.createElement('div');
        modal.className = 'modal-two';
        modal.innerHTML = `
            <header><h1>Message headers</h1></header>
            <div class="modal-content">
                <pre>
Received: from mail.proton.me
Message-Id: <123@proton.me>
Subject: Raw Header Test
                </pre>
            </div>
        `;
        document.body.appendChild(modal);

        const raw = extractProtonRawContent();
        expect(raw).toContain('Received: from mail.proton.me');
        expect(raw).toContain('Message-Id: <123@proton.me>');
    });

    it('should parse raw headers correctly', () => {
        const raw = `Received: from a.com
  by b.com with ESMTPS
Subject: Multi-line
  Test
From: user@a.com`;
        
        const headers = parseProtonHeaders(raw);
        expect(headers['received']).toBe('from a.com by b.com with ESMTPS');
        expect(headers['subject']).toBe('Multi-line Test');
        expect(headers['from']).toBe('user@a.com');
    });

    it('should return warnings when critical fields are missing', () => {
        const container = document.createElement('div');
        container.innerHTML = `<div data-testid="message-view">Empty</div>`;
        
        const result = extractProtonEmailContent(container);
        expect(result.success).toBe(false);
        expect(result.warnings).toContain('Subject not found');
        expect(result.warnings).toContain('Sender (From) not found');
    });
});
