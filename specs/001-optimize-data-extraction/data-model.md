# Data Model

### ProcessedEmailData

This is the primary logical entity that encompasses the optimized snapshot of the email that leaves the Extraction context. It extends the existing `ExtendedEmailData` type already defined in `src/types/email.ts`.

- **`headers`**
  - **Type**: `Record<string, string>`
  - **Description**: Contains only the core routing and addressing headers: `to`, `from`, `subject`, `reply-to`.
  - **Validation rules**: Keys MUST be lowercase. Missing optional headers (e.g., `reply-to`) are omitted from the record rather than set to empty strings.

- **`receivedChain`**
  - **Type**: `string[]`
  - **Description**: The ordered list of `Received` header values from the original email, preserved per Constitution Principle V.
  - **Validation rules**: Order must match the original header sequence (top-to-bottom).

- **`securityVerdicts`**
  - **Type**: `Record<'spf' | 'dkim' | 'dmarc', 'pass' | 'fail' | 'none' | 'softfail' | string>`
  - **Description**: The parsed results extracted from the `authentication-results` header string. Missing protocols are omitted from the record.

- **`body`**
  - **Type**: `string`
  - **Description**: The normalized, truncated email text with all user links replaced by `[LINK]`.
  - **Validation rules**: Maximum length is 1000 characters. Multiple spaces and newlines are normalized to single spaces.

- **`links`**
  - **Type**: `string[]`
  - **Description**: A deduplicated array of all raw URLs found in the original email body text, extracted using the canonical regex `https?:\/\/[^\s<>"')\]]+`.
