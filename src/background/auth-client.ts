
import { TOKEN_URL, TOKEN_EXPIRY_MARGIN_SECONDS, withApiKey, getClientId } from './api-config';

interface TokenResponse {
    token: string;
    tokenType: 'Bearer';
    expiresAt: number;
    issuedAt: number;
    issuer: string;
    audience: string;
    subject: string;
}

let cachedToken: string | null = null;
let cachedExpiresAt = 0;

export async function getValidToken(): Promise<string> {
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (cachedToken && cachedExpiresAt > nowSeconds + TOKEN_EXPIRY_MARGIN_SECONDS) {
        return cachedToken;
    }

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

export function invalidateToken(): void {
    cachedToken = null;
    cachedExpiresAt = 0;
}
