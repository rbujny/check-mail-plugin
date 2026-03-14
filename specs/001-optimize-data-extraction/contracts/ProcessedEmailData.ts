// This file defines the explicit TypeScript contract representing the data
// payload that the content script will prepare for downstream systems.
// At implementation time, this interface should be added to `src/types/email.ts`
// alongside the existing EmailData and ExtendedEmailData types.

export interface ProcessedEmailData {
    /** Only selected headers: to, from, subject, reply-to. All raw cryptographic headers MUST be dropped. Keys are lowercase. */
    headers: Record<string, string>;

    /** Ordered list of Received header values from the original email (per Constitution Principle V) */
    receivedChain: string[];

    /** Parsed authentication-results verdicts. Extracts string states rather than whole strings for ease of processing */
    securityVerdicts: {
        spf?: string;
        dkim?: string;
        dmarc?: string;
    };

    /** The normalized email body. Max 1000 characters, whitespaces normalized, URLs replaced by [LINK] */
    body: string;

    /** A deduplicated list of URLs extracted from the raw email body before it was normalized */
    links: string[];
}
