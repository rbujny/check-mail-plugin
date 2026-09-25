
import type { ProcessedEmailData } from '../../types/email';
import { stripHtml } from '../../utils/sanitizer';

const MAX_BODY_LENGTH = 1000;

const TRUNCATION_MARKER = ' [TRUNCATED]';

const MAX_URL_LENGTH = 2048;

const URL_TRUNCATION_MARKER = '...';

const URL_PATTERN = /(?:https?:\/\/|mailto:|data:)[a-zA-Z0-9\-._~:/?#\[\]@!$&*+,;=%()]+(?<![.,)])/gi;

const ALLOWED_HEADERS = new Set([
    'to',
    'from',
    'subject',
    'reply-to',
    'return-path',
]);

const CRYPTO_HEADERS = new Set([
    'arc-seal',
    'arc-message-signature',
    'arc-authentication-results',
    'dkim-signature',
]);

function toArray(value: string | string[] | undefined): string[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function toSingleOrConcat(value: string | string[] | undefined): string {
    if (!value) return '';
    return Array.isArray(value) ? value.join(' | ') : value;
}

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

        if (CRYPTO_HEADERS.has(lowerKey)) {
            continue;
        }

        if (lowerKey === 'received') {
            receivedChain.push(...toArray(value));
            continue;
        }

        if (lowerKey === 'authentication-results') {
            if (!authResultsRaw) {
                authResultsRaw = toArray(value)[0] || '';
            }
            continue;
        }

        if (ALLOWED_HEADERS.has(lowerKey)) {
            headers[lowerKey] = toSingleOrConcat(value);
        }
    }

    return { headers, receivedChain, authResultsRaw };
}

export function parseSecurityVerdicts(authResultsHeader: string): {
    spf?: string;
    dkim?: string;
    dmarc?: string;
} {
    const verdicts: { spf?: string; dkim?: string; dmarc?: string } = {};

    if (!authResultsHeader) {
        return verdicts;
    }

    const parts = authResultsHeader.split(';');

    for (const part of parts) {
        const trimmed = part.trim().toLowerCase();

        const spfMatch = trimmed.match(/\bspf\s*=\s*(\S+)/);
        if (spfMatch && !verdicts.spf) {
            verdicts.spf = spfMatch[1];
        }

        const dkimMatch = trimmed.match(/\bdkim\s*=\s*(\S+)/);
        if (dkimMatch && !verdicts.dkim) {
            verdicts.dkim = dkimMatch[1];
        }

        const dmarcMatch = trimmed.match(/\bdmarc\s*=\s*(\S+)/);
        if (dmarcMatch && !verdicts.dmarc) {
            verdicts.dmarc = dmarcMatch[1];
        }
    }

    return verdicts;
}

export function optimizeBody(rawBody: string): {
    body: string;
    links: string[];
    truncated: boolean;
} {
    if (!rawBody) {
        return { body: '', links: [], truncated: false };
    }

    const allUrls = rawBody.match(URL_PATTERN) || [];
    let uniqueLinks = [...new Set(allUrls)];

    if (uniqueLinks.length > 50) {
        uniqueLinks = uniqueLinks.slice(0, 50);
    }

    uniqueLinks = uniqueLinks.map(url =>
        url.length > MAX_URL_LENGTH
            ? url.substring(0, MAX_URL_LENGTH - URL_TRUNCATION_MARKER.length) + URL_TRUNCATION_MARKER
            : url
    );

    let processedBody = rawBody.replace(URL_PATTERN, '[LINK]');

    processedBody = stripHtml(processedBody);

    processedBody = processedBody.replace(/\s+/g, ' ').trim();

    let truncated = false;
    if (processedBody.length > MAX_BODY_LENGTH) {
        truncated = true;
        const cutLength = MAX_BODY_LENGTH - TRUNCATION_MARKER.length;
        processedBody = processedBody.substring(0, cutLength) + TRUNCATION_MARKER;
    }

    return { body: processedBody, links: uniqueLinks, truncated };
}

export function optimizeEmailData(
    rawHeaders: Record<string, string | string[]>,
    rawBody: string
): ProcessedEmailData {
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
