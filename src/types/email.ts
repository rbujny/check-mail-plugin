/**
 * EmailData represents the structured representation of a single
 * extracted email message from Gmail's DOM.
 */
export interface EmailData {
    /** Sender display name and email address */
    from: string;
    /** List of primary recipients */
    to: string[];
    /** List of CC recipients (empty array if absent) */
    cc: string[];
    /** Email subject line */
    subject: string;
    /** Date string as displayed in Gmail */
    date: string;
    /** Plain-text body extracted from HTML (with links preserved) */
    bodyText: string;
    /** ISO 8601 timestamp of when extraction occurred */
    extractionTimestamp: string;
}

/**
 * ExtendedEmailData represents a deeply parsed email from the 
 * 'Show Original' view, encompassing both structured data 
 * and granular parsed MIME entities.
 */
export interface ExtendedEmailData extends EmailData {
    /** Raw headers dictionary from the MIME payload */
    headers: Record<string, string>;
    /** The structured HTML or multipart body content if deciphered */
    rawBody: string;
    /** Collection of parsed attachments or extra bounds */
    attachmentsData?: unknown;
}

/**
 * ExtractionResult wraps an EmailData with metadata about the
 * extraction process, including success status and warnings.
 */
export interface ExtractionResult {
    /** true if all required fields were extracted successfully */
    success: boolean;
    /** List of warning messages for missing or failed fields */
    warnings: string[];
    /** Identifier for the email (subject or sender address) */
    source: string;
    /** The origin of the extraction: 'simplified' or 'original' */
    extractionSource?: 'simplified' | 'original';
    /** The extracted email data, or Extended data if sourced from raw payload */
    data: EmailData | ExtendedEmailData;
    /** Warning flag if > 5MB handling thresholds reached */
    rawSize?: number;
}
