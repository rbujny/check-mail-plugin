# Data Model: Send Data to Backend

## Entities

### `EmailDataPayload`
This is the structured JSON object that will be constructed and sent to `http://localhost:8080/process.php`. It matches the existing extracted formats.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `headers` | `Record<string, string>` | Yes | A dictionary of email headers, such as From, To, Subject, Date, and potentially DKIM/DMARC/SPF if parsed successfully. |
| `bodyText` | `string` | Yes | The textual content of the email, stripped of HTML formatting or returned as raw text, depending on what the extraction layer provides. |
| `metadata` | `object` | No | Additional metadata, such as parsing timestamp or extension version metrics for backend debugging. |

### Component State Update
- No new persistent local variables required.
- The `background` script needs temporary state to track `retryCount` (integer 0-3) for a given transmission ID during its lifetime.

## Validation Rules
- The HTTP request body MUST contain `headers` and `bodyText`.
- If a header is empty or undefined, it may be omitted or sent as null.
- The payload MUST be strictly structured as a valid JSON document encoded via `JSON.stringify()`.
