# Data Model: Yahoo Mail Support

## Overview
This feature leverages the existing `EmailData` and `ExtendedEmailData` structures. No schema changes are required to support Yahoo Mail, as the extraction goal is to normalize Yahoo's DOM into our standardized internal format.

## Entities

### EmailData (Reused)
Represents the simplified extraction from the standard Yahoo Mail view.
- `from`: string
- `to`: string[]
- `cc`: string[]
- `subject`: string
- `date`: string
- `bodyText`: string
- `extractionTimestamp`: string

### ExtendedEmailData (Reused)
Represents the full raw extraction from Yahoo's "View Raw Message" page.
- Inherits from `EmailData`
- `headers`: Record<string, string | string[]>
- `rawBody`: string
- `attachmentsData`: unknown (optional)

## Validation Rules
- **Sender/Recipient**: Must extract both name and email if available.
- **Date**: Must normalize Yahoo's date display to a parseable string.
- **Body**: In the standard view, HTML must be converted to plain text with meaningful whitespace preserved.
- **Raw View**: The entire content of the `pre` tag must be captured without truncation (unless >5MB warning applies).

## State Transitions
1. **Extraction**: DOM -> `EmailData`/`ExtendedEmailData`
2. **Optimization**: `EmailData` -> `ProcessedEmailData` (Stripping unnecessary headers, normalizing URLs)
3. **Dispatch**: Sent via `chrome.runtime.sendMessage` to the background service worker.
