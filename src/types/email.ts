export interface EmailData {
    from: string;
    to: string[];
    cc: string[];
    subject: string;
    date: string;
    bodyText: string;
    extractionTimestamp: string;
}

export interface ExtendedEmailData extends EmailData {
    headers: Record<string, string | string[]>;
    rawBody: string;
    attachmentsData?: unknown;
}

export interface ExtractionResult {
    success: boolean;
    warnings: string[];
    source: string;
    extractionSource?: 'simplified' | 'original';
    data: EmailData | ExtendedEmailData;
    rawSize?: number;
}

export const runtimeModelValues = [
    'gemini-3.5-flash-lite',
    'gemini-3.7-flash',
] as const;

export type RuntimeModel = (typeof runtimeModelValues)[number];

export interface ProcessedEmailData {
    headers: Record<string, string>;
    receivedChain: string[];
    securityVerdicts: {
        spf?: string;
        dkim?: string;
        dmarc?: string;
    };
    body: string;
    truncated: boolean;
    links: string[];
    model?: RuntimeModel;
}

