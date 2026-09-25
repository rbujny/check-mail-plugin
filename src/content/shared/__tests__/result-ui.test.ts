import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { showScanResult } from '../result-ui';

const CONTAINER_ID = 'checkmail-result-container';

function pressTab(): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    return event;
}

describe('showScanResult', () => {
    let attachShadowSpy: MockInstance<(init: ShadowRootInit) => ShadowRoot>;

    function lastShadowRoot(): ShadowRoot {
        const results = attachShadowSpy.mock.results;
        return results[results.length - 1].value as ShadowRoot;
    }

    beforeEach(() => {
        document.body.innerHTML = '';
        vi.useFakeTimers();
        vi.stubGlobal('chrome', { i18n: { getMessage: (key: string) => key } });
        attachShadowSpy = vi.spyOn(Element.prototype, 'attachShadow');
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('should render the comment as plain text instead of HTML', () => {
        const comment = '<img src=x onerror="alert(1)"><a href="https://evil.example">Zweryfikuj konto</a>';
        showScanResult({ result: 'WARNING', comment });

        const shadow = lastShadowRoot();
        expect(shadow.querySelector('img')).toBeNull();
        expect(shadow.querySelector('a')).toBeNull();
        expect(shadow.querySelector('#result-comment')?.textContent).toBe(comment);
    });

    it('should render the comment as plain text in the PHISHING modal', () => {
        const comment = '<b>bold</b><script>alert(1)</script>';
        showScanResult({ result: 'PHISHING', comment });

        const shadow = lastShadowRoot();
        expect(shadow.querySelector('b')).toBeNull();
        expect(shadow.querySelector('script')).toBeNull();
        expect(shadow.querySelector('#result-comment')?.textContent).toBe(comment);

        (shadow.querySelector('#dismiss-btn') as HTMLButtonElement).click();
    });

    it('should block the page with a backdrop and focus the confirmation button for PHISHING', () => {
        const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
        showScanResult({ result: 'PHISHING', comment: 'Suspicious link' });

        const shadow = lastShadowRoot();
        const card = shadow.querySelector('#result-card');
        const button = shadow.querySelector('#dismiss-btn');

        expect(shadow.querySelector('.backdrop')?.classList.contains('active')).toBe(true);
        expect(card?.getAttribute('role')).toBe('alertdialog');
        expect(card?.getAttribute('aria-modal')).toBe('true');
        expect(focusSpy.mock.contexts).toContain(button);

        (button as HTMLButtonElement).click();
    });

    it('should not dismiss the modal when the backdrop is clicked', () => {
        showScanResult({ result: 'PHISHING', comment: '' });

        const shadow = lastShadowRoot();
        (shadow.querySelector('.backdrop') as HTMLElement).click();
        vi.advanceTimersByTime(1000);

        expect(document.getElementById(CONTAINER_ID)).not.toBeNull();

        (shadow.querySelector('#dismiss-btn') as HTMLButtonElement).click();
    });

    it('should keep keyboard focus inside the modal until it is confirmed', () => {
        showScanResult({ result: 'PHISHING', comment: '' });
        const shadow = lastShadowRoot();

        expect(pressTab().defaultPrevented).toBe(true);

        (shadow.querySelector('#dismiss-btn') as HTMLButtonElement).click();
        vi.advanceTimersByTime(350);

        expect(document.getElementById(CONTAINER_ID)).toBeNull();
        expect(pressTab().defaultPrevented).toBe(false);
    });

    it('should release the keyboard trap when a new verdict replaces the modal', () => {
        showScanResult({ result: 'PHISHING', comment: '' });
        showScanResult({ result: 'OK', comment: 'Safe' });

        expect(document.querySelectorAll(`#${CONTAINER_ID}`)).toHaveLength(1);
        expect(pressTab().defaultPrevented).toBe(false);
    });

    it('should not use a backdrop for non-critical verdicts', () => {
        showScanResult({ result: 'WARNING', comment: '' });

        const shadow = lastShadowRoot();
        expect(shadow.querySelector('.backdrop')?.classList.contains('active')).toBe(false);
        expect(shadow.querySelector('#result-card')?.getAttribute('role')).toBe('status');
        expect(pressTab().defaultPrevented).toBe(false);
    });

    it('should auto-dismiss the OK verdict after 6 seconds', () => {
        showScanResult({ result: 'OK', comment: 'Safe' });

        vi.advanceTimersByTime(5999);
        expect(document.getElementById(CONTAINER_ID)).not.toBeNull();

        vi.advanceTimersByTime(1 + 350);
        expect(document.getElementById(CONTAINER_ID)).toBeNull();
    });

    it('should fall back to WARNING for an unknown result', () => {
        showScanResult({ result: 'UNKNOWN', comment: '' });

        const shadow = lastShadowRoot();
        expect(shadow.querySelector('.title')?.textContent).toBe('tierWarningTitle');
        expect(shadow.querySelector('.backdrop')?.classList.contains('active')).toBe(false);
    });
});
