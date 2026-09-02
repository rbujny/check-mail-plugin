
import type { ExtractionResult } from '../types/email';

const LOG_PREFIX = '[CheckMailPlugin]';

export function logExtractionResult(result: ExtractionResult): void {
    const timestamp = result.data.extractionTimestamp;
    const groupLabel = `${LOG_PREFIX} Email Extraction — ${result.source} (${timestamp})`;

    console.group(groupLabel);

    console.log('Extraction result:', result);

    console.log('From:', result.data.from);
    console.log('To:', result.data.to.join(', '));
    if (result.data.cc.length > 0) {
        console.log('Cc:', result.data.cc.join(', '));
    }
    console.log('Subject:', result.data.subject || '(no subject)');
    console.log('Date:', result.data.date || '(no date)');
    console.log('Body length:', result.data.bodyText.length, 'characters');

    if (result.warnings.length > 0) {
        result.warnings.forEach((warning) => {
            console.warn(`${LOG_PREFIX} Warning:`, warning);
        });
    }

    if (result.rawSize && result.rawSize > 5 * 1024 * 1024) {
        console.warn(`${LOG_PREFIX} Warning: Payload size exceeds 5MB (${(result.rawSize / 1024 / 1024).toFixed(2)} MB). Main thread blocking may occur.`);
    }

    if (result.success) {
        console.log(`%c${LOG_PREFIX} Extraction successful`, 'color: #34a853; font-weight: bold');
    } else {
        console.warn(`${LOG_PREFIX} Extraction completed with warnings`);
    }

    console.groupEnd();
}
