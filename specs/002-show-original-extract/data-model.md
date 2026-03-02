# Entities

## RawEmailData
The complete text payload from the 'Show Original' screen.
- **payload**: `string` - The exact MIME data containing headers, bounds, and parts.
- **source**: `string` - Indicates if the source was `simplified` or `show_original`.
- **validation**: Cannot be null. If extraction fails, an error is thrown instead. Size > 5MB triggers a warning log.

## ProcessedEmailData
The shared interface for logging out the data to the console (already implemented for simplified view, now being extended by the raw view).
- **headers**: `Record<string, string>` - Key-value pair headers natively available in simplified view, and the raw headers in the show-original view.
- **body**: `string` - The message body.
- **source**: `string` - Helps distinguish where the logger received the info.
