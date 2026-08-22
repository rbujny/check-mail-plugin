/// <reference types="chrome" />

/**
 * API Configuration for the CheckMailPlugin backend.
 *
 * Centralises all endpoint URLs and authentication constants
 * so they are never scattered across multiple modules.
 */

/**
 * Base URL for the CheckMail API.
 *
 * Defaults to 'http://localhost:8080' for local development.
 * In CI/CD (GitHub Actions) or production builds, inject via the
 * CHECKMAIL_API_BASE_URL environment variable / GitHub Variable.
 */
export const API_BASE_URL = process.env.CHECKMAIL_API_BASE_URL || 'http://localhost:8080';

/** Token issuing endpoint (public — no JWT required). */
export const TOKEN_URL = `${API_BASE_URL}/token`;

/** Email processing endpoint (requires Authorization: Bearer JWT). */
export const PROCESS_URL = `${API_BASE_URL}/process`;

/**
 * Safety margin in seconds.  A cached token is considered expired
 * this many seconds *before* its actual `expiresAt` timestamp,
 * so we never send a request with a token that expires mid-flight.
 */
export const TOKEN_EXPIRY_MARGIN_SECONDS = 60;

/**
 * Optional GCP API Gateway API key for quota attribution.
 * Defaults to empty string for local development.
 * In CI/CD (GitHub Actions), inject via the CHECKMAIL_API_KEY
 * environment variable / GitHub Secret.
 */
export const API_KEY = process.env.CHECKMAIL_API_KEY || '';

/**
 * Returns the given URL with the API key query parameter appended
 * if an API_KEY has been configured, otherwise returns the URL
 * unchanged.
 */
export function withApiKey(url: string): string {
    if (!API_KEY) {
        return url;
    }
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}key=${encodeURIComponent(API_KEY)}`;
}

/**
 * Storage key used to persist the per-installation client UUID
 * inside `chrome.storage.local`.
 */
const CLIENT_ID_STORAGE_KEY = 'checkmail_client_id';

/**
 * Returns a stable, per-installation UUID that is used as the
 * `subject` field in JWT token requests.
 *
 * On first call the UUID is generated via `crypto.randomUUID()`
 * and persisted in `chrome.storage.local` so it survives Service
 * Worker restarts and browser updates.  Subsequent calls return
 * the stored value.
 */
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
