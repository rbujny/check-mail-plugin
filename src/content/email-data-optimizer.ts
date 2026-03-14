/**
 * Email Data Optimizer for CheckMailPlugin.
 *
 * Processes raw extraction results into a minimal, privacy-respecting
 * ProcessedEmailData payload before transmission to the Communication layer.
 *
 * Responsibilities:
 * - Filter headers to only targeting headers (to, from, subject, reply-to, return-path)
 * - Preserve Received chain per Constitution Principle V
 * - Parse authentication-results into security verdicts (SPF, DKIM, DMARC)
 * - Strip raw cryptographic signatures (arc-seal, dkim-signature, etc.)
 * - Extract and deduplicate URLs from body text (http, https, mailto, data schemes)
 * - Replace inline URLs with [LINK] placeholder
 * - Normalize whitespace
 * - Truncate body to 1000 characters with [TRUNCATED] marker
 */

import type { ProcessedEmailData } from '../types/email';
import { stripHtml } from '../utils/sanitizer';

/** Maximum length for the processed body text */
const MAX_BODY_LENGTH = 1000;

/** Marker appended when body text is truncated */
const TRUNCATION_MARKER = ' [TRUNCATED]';

/**
 * URL regex pattern — matches HTTP/HTTPS URLs, mailto: and data: schemes.
 * Uses strict character classes for the URL body to prevent capturing trailing
 * words if there's no space delimiter (e.g. "https://urlYourPage").
 * The lookbehind/character constraints ensure it doesn't end on punctuation like ')' or ','.
 * mailto: captures phishing reply-to vectors, data: captures payload injection vectors.
 * (see research.md Decision 4, extended per security review)
 */
const URL_PATTERN = /(?:https?:\/\/|mailto:|data:)[a-zA-Z0-9\-._~:/?#\[\]@!$&*+,;=%()]+(?<![.,)])/gi;

/** Headers to retain (lowercase). All others are dropped. */
const ALLOWED_HEADERS = new Set([
    'to',
    'from',
    'subject',
    'reply-to',
    'return-path',
]);

/** Headers containing raw cryptographic material that MUST be excluded */
const CRYPTO_HEADERS = new Set([
    'arc-seal',
    'arc-message-signature',
    'arc-authentication-results',
    'dkim-signature',
]);

/**
 * Resolves a header value that may be a single string or an array
 * of strings into a flat array. Handles the Record<string, string | string[]>
 * format from the upstream MIME parser.
 */
function toArray(value: string | string[] | undefined): string[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

/**
 * Resolves a header value to a single string. If multiple values are present
 * (Header Smuggling / Duplicate fields), it joins them with a pipe character
 * so that both are visible to the LLM analyzer and nothing is hidden.
 */
function toSingleOrConcat(value: string | string[] | undefined): string {
    if (!value) return '';
    return Array.isArray(value) ? value.join(' | ') : value;
}

/**
 * Filters a raw headers record down to only the allowed targeting headers.
 * All keys are normalized to lowercase.
 * Also extracts the Received chain and authentication-results in one pass
 * to avoid case-sensitivity bugs from separate lookups.
 *
 * @param rawHeaders - The full headers dictionary from extraction (may contain string[] values)
 * @returns Targeting headers, Received chain, and raw authentication-results string
 */
export function optimizeHeaders(rawHeaders: Record<string, string | string[]>): {
    headers: Record<string, string>;
    receivedChain: string[];
    authResultsRaw: string;
} {
    const headers: Record<string, string> = {};
    const receivedChain: string[] = [];
    let authResultsRaw = '';

    for (const [key, value] of Object.entries(rawHeaders)) {
        const lowerKey = key.toLowerCase();

        // Skip cryptographic signature headers explicitly
        if (CRYPTO_HEADERS.has(lowerKey)) {
            continue;
        }

        // Collect Received chain entries (preserving all values from arrays)
        if (lowerKey === 'received') {
            receivedChain.push(...toArray(value));
            continue;
        }

        // Extract authentication-results (case-insensitive, single-pass)
        if (lowerKey === 'authentication-results') {
            // Append multiple auth-results headers together safely
            const newAuth = toArray(value).join('; ');
            authResultsRaw = authResultsRaw ? `${authResultsRaw}; ${newAuth}` : newAuth;
            continue;
        }

        // Keep only allowed targeting headers (protect against header smuggling by concatenating if duplicated)
        if (ALLOWED_HEADERS.has(lowerKey)) {
            headers[lowerKey] = toSingleOrConcat(value);
        }
    }

    return { headers, receivedChain, authResultsRaw };
}

/**
 * Parses the authentication-results header string and extracts
 * human-readable verdicts for SPF, DKIM, and DMARC.
 *
 * @param authResultsHeader - The raw authentication-results header value
 * @returns An object with spf, dkim, dmarc verdict strings (when found)
 */
export function parseSecurityVerdicts(authResultsHeader: string): {
    spf?: string;
    dkim?: string;
    dmarc?: string;
} {
    const verdicts: { spf?: string; dkim?: string; dmarc?: string } = {};

    if (!authResultsHeader) {
        return verdicts;
    }

    // Split by semicolons to get individual check results
    const parts = authResultsHeader.split(';');

    for (const part of parts) {
        const trimmed = part.trim().toLowerCase();

        // Match patterns like "spf=pass", "dkim=fail", "dmarc=none"
        const spfMatch = trimmed.match(/\bspf\s*=\s*(\S+)/);
        if (spfMatch) {
            verdicts.spf = spfMatch[1];
        }

        const dkimMatch = trimmed.match(/\bdkim\s*=\s*(\S+)/);
        if (dkimMatch) {
            verdicts.dkim = dkimMatch[1];
        }

        const dmarcMatch = trimmed.match(/\bdmarc\s*=\s*(\S+)/);
        if (dmarcMatch) {
            verdicts.dmarc = dmarcMatch[1];
        }
    }

    return verdicts;
}

/**
 * Extracts all URLs from the body text (http, https, mailto, data schemes),
 * deduplicates them, replaces them with [LINK] placeholders, normalizes
 * whitespace, and truncates to MAX_BODY_LENGTH with a [TRUNCATED] marker.
 *
 * @param rawBody - The raw email body text
 * @returns An object with the processed body string, deduplicated links array, and truncation flag
 */
export function optimizeBody(rawBody: string): {
    body: string;
    links: string[];
    truncated: boolean;
} {
    if (!rawBody) {
        return { body: '', links: [], truncated: false };
    }

    // Step 1: Extract all URLs and deduplicate
    const allUrls = rawBody.match(URL_PATTERN) || [];
    let uniqueLinks = [...new Set(allUrls)];

    // Capping max extracted links to mitigate Payload DoS attacks
    if (uniqueLinks.length > 50) {
        uniqueLinks = uniqueLinks.slice(0, 50);
    }

    // Cap individual URL length to 2048 characters to prevent URL-stuffing payload attacks
    // (Bypassing the 1000-char body limit by omitting whitespace inside a data:/http: string)
    uniqueLinks = uniqueLinks.map(url =>
        url.length > 2048 ? url.substring(0, 2048) + '...' : url
    );

    // Step 2: Replace all URLs with [LINK] placeholder
    let processedBody = rawBody.replace(URL_PATTERN, '[LINK]');

    // Step 3: Strip HTML tags and entities
    // We do this AFTER link extraction so that href="https://..." URLs are still found and mapped cleanly
    processedBody = stripHtml(processedBody);

    // Step 4: Normalize whitespace (collapse multiple spaces/newlines into single space)
    processedBody = processedBody.replace(/\s+/g, ' ').trim();

    // Step 5: Truncate to max length with marker if needed
    let truncated = false;
    if (processedBody.length > MAX_BODY_LENGTH) {
        truncated = true;
        const cutLength = MAX_BODY_LENGTH - TRUNCATION_MARKER.length;
        processedBody = processedBody.substring(0, cutLength) + TRUNCATION_MARKER;
    }

    return { body: processedBody, links: uniqueLinks, truncated };
}

/**
 * Main optimization function. Takes raw extraction data and produces
 * a minimal ProcessedEmailData payload ready for the Communication layer.
 *
 * @param rawHeaders - The complete headers dictionary from extraction (supports string[] values)
 * @param rawBody - The raw email body text
 * @returns A fully optimized ProcessedEmailData object
 */
export function optimizeEmailData(
    rawHeaders: Record<string, string | string[]>,
    rawBody: string
): ProcessedEmailData {
    // Single-pass header extraction: targeting headers, Received chain,
    // and authentication-results are all extracted case-insensitively
    const { headers, receivedChain, authResultsRaw } = optimizeHeaders(rawHeaders);
    const securityVerdicts = parseSecurityVerdicts(authResultsRaw);
    const { body, links, truncated } = optimizeBody(rawBody);

    return {
        headers,
        receivedChain,
        securityVerdicts,
        body,
        truncated,
        links,
    };
}
