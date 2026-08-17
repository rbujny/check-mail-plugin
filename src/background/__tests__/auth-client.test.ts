import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Stub chrome.storage.local before anything else ──────────────
vi.hoisted(() => {
    const store: Record<string, unknown> = {};
    vi.stubGlobal('chrome', {
        storage: {
            local: {
                get: vi.fn(async (key: string) => {
                    return { [key]: store[key] };
                }),
                set: vi.fn(async (items: Record<string, unknown>) => {
                    Object.assign(store, items);
                }),
            },
        },
    });

    // Provide crypto.randomUUID in the test environment
    if (typeof globalThis.crypto === 'undefined') {
        vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' });
    } else if (!globalThis.crypto.randomUUID) {
        vi.stubGlobal('crypto', { ...globalThis.crypto, randomUUID: () => 'test-uuid-1234' });
    }
});

// ── Mock global fetch ───────────────────────────────────────────
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// ── Import the module under test (after global stubs) ───────────
import { getValidToken, invalidateToken } from '../auth-client';

/**
 * Helper: build a successful /token JSON response.
 */
function tokenResponseBody(overrides: Record<string, unknown> = {}) {
    return {
        token: 'jwt-token-abc',
        tokenType: 'Bearer',
        expiresAt: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        issuedAt: Math.floor(Date.now() / 1000),
        issuer: 'checkmail-backend',
        audience: 'checkmail-clients',
        subject: 'test-uuid-1234',
        ...overrides,
    };
}

function okTokenResponse(overrides: Record<string, unknown> = {}) {
    return {
        ok: true,
        status: 200,
        json: async () => tokenResponseBody(overrides),
        text: async () => JSON.stringify(tokenResponseBody(overrides)),
    };
}

describe('auth-client', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset cached token between tests by invalidating
        invalidateToken();
    });

    it('should fetch a new token on first call', async () => {
        fetchMock.mockResolvedValueOnce(okTokenResponse());

        const token = await getValidToken();

        expect(token).toBe('jwt-token-abc');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/token'),
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
        );
    });

    it('should return cached token on subsequent calls within expiry window', async () => {
        fetchMock.mockResolvedValueOnce(okTokenResponse());

        const first = await getValidToken();
        const second = await getValidToken();

        expect(first).toBe(second);
        // Only one fetch call — the second returned from cache
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should refresh token when cached one is near expiry', async () => {
        // First call: token that expires in 30 seconds (within 60s margin)
        fetchMock.mockResolvedValueOnce(
            okTokenResponse({ expiresAt: Math.floor(Date.now() / 1000) + 30 })
        );

        const first = await getValidToken();
        expect(first).toBe('jwt-token-abc');
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // Second call: the cached token is within margin, should re-fetch
        fetchMock.mockResolvedValueOnce(
            okTokenResponse({ token: 'jwt-token-refreshed' })
        );

        const second = await getValidToken();
        expect(second).toBe('jwt-token-refreshed');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should throw on non-200 response from /token', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 400,
            text: async () => '{"error":"bad request"}',
        });

        await expect(getValidToken()).rejects.toThrow(/Token request failed with status 400/);
    });

    it('should clear cache on invalidateToken()', async () => {
        // Prime the cache
        fetchMock.mockResolvedValueOnce(okTokenResponse());
        await getValidToken();
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // Invalidate
        invalidateToken();

        // Next call should fetch again
        fetchMock.mockResolvedValueOnce(
            okTokenResponse({ token: 'jwt-token-new' })
        );
        const token = await getValidToken();
        expect(token).toBe('jwt-token-new');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should send the client UUID as subject in the token request body', async () => {
        fetchMock.mockResolvedValueOnce(okTokenResponse());

        await getValidToken();

        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        // The UUID comes from our stubbed crypto.randomUUID / chrome.storage.local
        expect(callBody).toHaveProperty('subject');
        expect(typeof callBody.subject).toBe('string');
        expect(callBody.subject.length).toBeGreaterThan(0);
    });
});
