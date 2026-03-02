# Data Model: Gmail Email Extraction

**Feature**: `001-gmail-email-extraction`
**Date**: 2026-02-28

## Entities

### EmailData

The structured representation of a single extracted email message.

| Field               | Type       | Required | Description                                      |
|---------------------|------------|----------|--------------------------------------------------|
| `from`              | `string`   | Yes      | Sender display name and email address             |
| `to`                | `string[]` | Yes      | List of primary recipients                        |
| `cc`                | `string[]` | No       | List of CC recipients (empty array if absent)     |
| `subject`           | `string`   | Yes      | Email subject line                                |
| `date`              | `string`   | Yes      | Date string as displayed in Gmail                 |
| `bodyText`          | `string`   | Yes      | Plain-text body extracted from HTML (with links)  |
| `extractionTimestamp`| `string`  | Yes      | ISO 8601 timestamp of when extraction occurred    |

**Validation rules**:
- `from` MUST NOT be empty. If DOM extraction fails, set to
  `"[extraction failed]"` and add a warning.
- `to` MUST contain at least one entry. If extraction fails, set to
  `["[extraction failed]"]` and add a warning.
- `subject` MAY be empty (legitimate for emails with no subject).
- `bodyText` MAY be empty (legitimate for empty-body emails).
- `extractionTimestamp` MUST be generated at extraction time, not
  dependent on DOM content.

### ExtractionResult

Wraps an `EmailData` with metadata about the extraction process.

| Field      | Type          | Required | Description                                         |
|------------|---------------|----------|-----------------------------------------------------|
| `success`  | `boolean`     | Yes      | `true` if all required fields extracted successfully |
| `warnings` | `string[]`    | Yes      | List of warning messages for missing/failed fields   |
| `source`   | `string`      | Yes      | Identifier for the email (subject or message ID)    |
| `data`     | `EmailData`   | Yes      | The extracted email data                             |

**Validation rules**:
- `success` is `true` only when `from`, `to`, `subject`, `date`, and
  `bodyText` are all extracted without fallback values.
- `warnings` is an empty array when `success` is `true`.
- `source` SHOULD be the subject line. If subject is empty, use the
  sender address. If both fail, use `"[unknown source]"`.

## Relationships

```text
ExtractionResult 1 ──contains── 1 EmailData
```

There are no persistence relationships — both entities exist only in
memory during extraction and are written to the console log. They are
garbage-collected after the console group is closed.

## State Transitions

These entities have no lifecycle states. They are created once during
extraction and immediately logged. There is no update or delete flow.

```text
[Icon Click] → [Extract from DOM] → [Build EmailData] → [Wrap in ExtractionResult] → [Log to Console] → [Discard]
```
