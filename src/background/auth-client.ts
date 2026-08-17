/**
 * JWT Authentication Client for the CheckMailPlugin Service Worker.
 *
 * Manages the lifecycle of a JWT access token used to authorise
 * requests against the CheckMail backend `/process` endpoint.
 *
 * Key behaviours:
 * - Caches the token in module-level variables (memory only).
 * - Refreshes proactively when the token is within
 *   TOKEN_EXPIRY_MARGIN_SECONDS of expiry.
 * - Exposes `invalidateToken()` so the caller can force a refresh
 *   after receiving a 401 Unauthorized response.
 */

import { TOKEN_URL, TOKEN_EXPIRY_MARGIN_SECONDS, withApiKey, getClientId } from './api-config';

/** Shape of the JSON body returned by POST /token. */
interface TokenResponse {
    token: string;
    tokenType: 'Bearer';
    expiresAt: number;
    issuedAt: number;
    issuer: string;
    audience: string;
    subject: string;
}

// ── Module-level cache ─────────────────────────────────────────────
let cachedToken: string | null = null;
let cachedExpiresAt = 0; // Unix timestamp in seconds

/**
 * Returns a valid JWT access token, either from cache or by
 * requesting a fresh one from the `/token` endpoint.
 *
 * @throws {Error} If the token endpoint returns a non-200 status
 *                 or the response cannot be parsed.
 */
export async function getValidToken(): Promise<string> {
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (cachedToken && cachedExpiresAt > nowSeconds + TOKEN_EXPIRY_MARGIN_SECONDS) {
        return cachedToken;
    }

    // Fetch a fresh token
    const clientId = await getClientId();

    const response = await fetch(withApiKey(TOKEN_URL), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: clientId }),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(
            `Token request failed with status ${response.status}: ${errorText}`
        );
    }

    const data: TokenResponse = await response.json();

    if (!data.token || typeof data.expiresAt !== 'number') {
        throw new Error('Invalid token response: missing token or expiresAt.');
    }

    cachedToken = data.token;
    cachedExpiresAt = data.expiresAt;

    return cachedToken;
}

/**
 * Clears the cached token so the next call to `getValidToken()`
 * will request a fresh one.
 *
 * Call this when the backend responds with 401 Unauthorized,
 * indicating that the current token has been revoked or is
 * otherwise invalid despite not having reached its `expiresAt`.
 */
export function invalidateToken(): void {
    cachedToken = null;
    cachedExpiresAt = 0;
}
