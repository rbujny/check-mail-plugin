/// <reference types="chrome" />

export const API_BASE_URL = process.env.CHECKMAIL_API_BASE_URL || 'http://localhost:8080';

export const TOKEN_URL = `${API_BASE_URL}/token`;

export const PROCESS_URL = `${API_BASE_URL}/process`;

export const TOKEN_EXPIRY_MARGIN_SECONDS = 60;

export const API_KEY = process.env.CHECKMAIL_API_KEY || '';

export function withApiKey(url: string): string {
    if (!API_KEY) {
        return url;
    }
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}key=${encodeURIComponent(API_KEY)}`;
}

const CLIENT_ID_STORAGE_KEY = 'checkmail_client_id';

export async function getClientId(): Promise<string> {
    const result = await chrome.storage.local.get(CLIENT_ID_STORAGE_KEY);
    const existing = result[CLIENT_ID_STORAGE_KEY];
    if (typeof existing === 'string' && existing.length > 0) {
        return existing;
    }

    const newId = crypto.randomUUID();
    await chrome.storage.local.set({ [CLIENT_ID_STORAGE_KEY]: newId });
    return newId;
}
