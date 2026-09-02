/// <reference types="chrome" />

export function showToastError(message: string): void {
    const toast = document.createElement('div');
    toast.textContent = message;

    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#d32f2f',
        color: '#ffffff',
        padding: '12px 24px',
        borderRadius: '8px',
        fontFamily: 'sans-serif',
        fontSize: '14px',
        fontWeight: 'bold',
        boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
        zIndex: '999999',
        transition: 'opacity 0.3s ease-in-out',
        opacity: '0'
    });

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
        });
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

import { showScanResult } from './result-ui';

export function setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((request) => {
        if (request.type === 'SHOW_TOAST_ERROR') {
            showToastError(request.message);
        } else if (request.type === 'SHOW_SCAN_RESULT' && request.payload) {
            showScanResult(request.payload);
        }
    });
}
