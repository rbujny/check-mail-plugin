import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showToastError } from '../toast';

describe('toast UI component', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        vi.useFakeTimers();
        // Mock requestAnimationFrame
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            return setTimeout(() => callback(Date.now()), 16);
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('should create a toast element with the provided message', () => {
        const message = 'Test Error Message';
        showToastError(message);

        const toast = document.querySelector('div');
        expect(toast).not.toBeNull();
        expect(toast?.textContent).toBe(message);
        expect(toast?.style.backgroundColor).toBe('rgb(211, 47, 47)'); // #d32f2f
    });

    it('should fade in the toast using requestAnimationFrame', async () => {
        showToastError('Fade test');
        const toast = document.querySelector('div')!;

        expect(toast.style.opacity).toBe('0');

        // requestAnimationFrame is nested twice in toast.ts
        vi.advanceTimersByTime(16); // First RAF
        vi.advanceTimersByTime(16); // Second RAF

        expect(toast.style.opacity).toBe('1');
    });

    it('should remove the toast after the 5s timeout plus fade-out delay', () => {
        showToastError('Removal test');
        const toast = document.querySelector('div')!;
        expect(document.body.contains(toast)).toBe(true);

        // Advance 5 seconds to trigger fade out
        vi.advanceTimersByTime(5000);
        expect(toast.style.opacity).toBe('0');

        // Advance 300ms for the removal timeout
        vi.advanceTimersByTime(300);
        expect(document.body.contains(toast)).toBe(false);
    });
});
