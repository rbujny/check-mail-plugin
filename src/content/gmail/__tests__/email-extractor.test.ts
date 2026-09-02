import { describe, it, expect, beforeEach, vi } from 'vitest';
import { extractEmailContent } from '../email-extractor';

if (!Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText')) {
    Object.defineProperty(HTMLElement.prototype, 'innerText', {
        get() {
            return this.textContent;
        },
        set(v) {
            this.textContent = v;
        },
        configurable: true,
    });
}

describe('email-extractor', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        document.title = 'Inbox (1) - user@example.com - Gmail';
    });

    it('should extract basic email data from a standard Gmail message container', () => {
        const messageContainer = document.createElement('div');
        messageContainer.innerHTML = `
            <div role="listitem">
                <div class="gE iv">
                    <table class="cf ajC">
                        <tbody>
                            <tr class="acZ">
                                <td>
                                    <h3 class="iw">
                                        <span class="qu" email="sender@example.com" name="Sender Name">Sender Name</span>
                                    </h3>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="adn ads">
                        <div class="gs">
                            <div class="g3" title="Mon, Mar 9, 2026 at 12:00 PM">12:00 PM</div>
                        </div>
                    </div>
                </div>
                <div class="a3s aiL" dir="ltr">
                    Hello, this is a test message.
                </div>
            </div>
        `;

        const subjectEl = document.createElement('h2');
        subjectEl.className = 'hP';
        subjectEl.textContent = 'Test Subject Line';
        document.body.appendChild(subjectEl);
        document.body.appendChild(messageContainer);

        const result = extractEmailContent(messageContainer);

        expect(result.success).toBe(true);
        expect(result.data.from).toBe('Sender Name <sender@example.com>');
        expect(result.data.subject).toBe('Test Subject Line');
        expect(result.data.date).toBe('Mon, Mar 9, 2026 at 12:00 PM');
        expect(result.data.bodyText).toBe('Hello, this is a test message.');
    });

    it('should extract recipients (To/Cc) from the expanded header table', () => {
        const messageContainer = document.createElement('div');
        messageContainer.innerHTML = `
            <div class="ajv">
                <table class="cf">
                    <tr class="ajA">
                        <td class="aHI">to:</td>
                        <td class="ajL">
                            <span email="recipient1@example.com">Recipient 1</span>,
                            <span email="recipient2@example.com">Recipient 2</span>
                        </td>
                    </tr>
                    <tr class="ajA">
                        <td class="aHI">cc:</td>
                        <td class="ajL">
                            <span email="cc1@example.com">CC 1</span>
                        </td>
                    </tr>
                </table>
            </div>
            <div class="gD" email="sender@example.com">Sender</div>
            <span class="g3" title="Mar 9, 2026, 12:00 PM"></span>
            <div class="a3s">Body</div>
        `;
        document.body.appendChild(messageContainer);

        const result = extractEmailContent(messageContainer);

        expect(result.data.to).toEqual(['recipient1@example.com', 'recipient2@example.com']);
        expect(result.data.cc).toEqual(['cc1@example.com']);
    });

    it('should pre-process links into "text (url)" format in body extraction', () => {
        const messageContainer = document.createElement('div');
        messageContainer.innerHTML = `
            <div class="gD" email="sender@example.com">Sender</div>
            <span class="g3" title="Mar 9, 2026, 12:00 PM"></span>
            <div class="a3s">
                Check this <a href="https://example.com/phish">suspicious link</a> 
                and also <a href="https://google.com">https://google.com</a> (which should stay as is).
            </div>
        `;
        document.body.appendChild(messageContainer);

        const result = extractEmailContent(messageContainer);

        expect(result.data.bodyText).toContain('suspicious link (https://example.com/phish)');
        expect(result.data.bodyText).toContain('https://google.com');
        expect(result.data.bodyText).not.toContain('https://google.com (https://google.com)');
    });

    it('should fall back to document title for subject if no h2.hP is found', () => {
        document.title = 'Important Security Alert - user@gmail.com - Gmail';
        const messageContainer = document.createElement('div');
        messageContainer.innerHTML = `
            <div class="gD" email="sender@example.com">Sender</div>
            <span class="g3" title="Mar 9, 2026, 12:00 PM"></span>
            <div class="a3s">Body</div>
        `;
        document.body.appendChild(messageContainer);

        const result = extractEmailContent(messageContainer);
        expect(result.data.subject).toBe('Important Security Alert');
    });

    it('should handle missing date and mark success=false', () => {
        const messageContainer = document.createElement('div');
        messageContainer.innerHTML = `
            <div class="gD" email="sender@example.com">Sender</div>
            <div class="a3s">Body</div>
        `;
        document.body.appendChild(messageContainer);

        const result = extractEmailContent(messageContainer);

        expect(result.success).toBe(false);
        expect(result.warnings).toContain('Could not extract date from DOM');
    });

    it('should handle malformed sender gracefully', () => {
        const messageContainer = document.createElement('div');
        messageContainer.innerHTML = `
            <div class="a3s">Body</div>
        `;
        document.body.appendChild(messageContainer);

        const result = extractEmailContent(messageContainer);

        expect(result.success).toBe(false);
        expect(result.data.from).toBe('[extraction failed]');
    });
});
