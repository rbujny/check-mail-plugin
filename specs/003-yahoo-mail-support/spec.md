# Feature Specification: Yahoo Mail Support

**Feature Branch**: `003-yahoo-mail-support`  
**Created**: 2026-03-15  
**Status**: Draft  
**Input**: User description: "Based on our detecting and processing mail in gmail, do the same with another mail client -> yahoo"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scan Email Button in Yahoo Mail (Priority: P1)

A user is reading an email in Yahoo Mail. They notice the CheckMailPlugin shield icon in the email toolbar — positioned near existing action buttons like "Reply", "Forward", or "Print". The icon blends with Yahoo's native UI. When clicked, it extracts the simplified email content.

**Why this priority**: Parity with the Gmail integration. This is the primary entry point for users to scan standard emails in Yahoo Mail.

**Independent Test**: Can be fully tested by opening an email in Yahoo Mail, verifying the icon appears, and clicking it to see the extracted simplified data logged in the console.

**Acceptance Scenarios**:

1. **Given** the user opens an email in Yahoo Mail, **When** the page loads, **Then** the plugin's shield icon MUST appear in the toolbar area.
2. **Given** the shield icon is visible, **When** the user clicks it, **Then** the plugin MUST extract the simplified email data (sender, recipients, subject, date, body text) and log it in the console, matching the payload structure used for Gmail.
3. **Given** the user navigates between different emails in Yahoo Mail, **When** the view updates, **Then** the shield icon MUST update appropriately and correspond to the currently visible email.

---

### User Story 2 - Raw Email Extraction from 'View Raw Message' (Priority: P1)

A user needs to inspect the deep headers of an email in Yahoo Mail. They open Yahoo's equivalent of "Show Original" (e.g., "View Raw Message"). The plugin detects this view, injects its shield icon, and upon clicking, extracts the full raw email text for processing and logging.

**Why this priority**: Parity with the Gmail feature. Required for accessing complete email headers and metadata for advanced analysis.

**Independent Test**: Can be tested by opening Yahoo Mail's raw message view, clicking the injected shield icon, and verifying the raw payload is processed and logged correctly.

**Acceptance Scenarios**:

1. **Given** the user opens the "View Raw Message" (or equivalent raw source view) in Yahoo Mail, **When** the page loads, **Then** the shield icon MUST appear alongside the native actions.
2. **Given** the shield icon is clicked in the raw view, **When** extraction occurs, **Then** the plugin MUST capture the entire raw email text (headers and body).
3. **Given** the raw text is extracted, **When** extraction completes, **Then** it MUST be processed and logged using the same mechanism as the Gmail implementation.

---

### Edge Cases

- What happens if Yahoo Mail changes its DOM structure or CSS classes? The system MUST fail gracefully by halting injection and logging a silent structured error to the console, without freezing the native UI.
- What happens if a raw message payload is extremely large (e.g., >5MB)? The system MUST extract it but log a console warning before doing so, matching the Gmail feature's constraints.
- What happens if the user clicks the shield multiple times rapidly? The system MUST ignore subsequent clicks while an extraction is already in progress (debouncing).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST define DOM selectors and injection logic specifically for Yahoo Mail's (`mail.yahoo.com`) standard email reading interface to inject the shield icon.
- **FR-002**: The system MUST extract the visible email data (sender, recipients, subject, date, body text) from the Yahoo Mail DOM when the shield icon in the standard view is clicked.
- **FR-003**: The system MUST detect Yahoo Mail's "View Raw Message" (or equivalent) view, inject the shield icon, and extract the complete raw message text on click.
- **FR-004**: The system MUST parse and process the extracted data from Yahoo Mail (both simplified and raw) into the identical standardized format (`EmailData`) used for Gmail before logging it.
- **FR-005**: The system MUST use the existing unified logging mechanism for outputs.
- **FR-006**: The extension manifest MUST be updated to include permissions for Yahoo Mail (`https://mail.yahoo.com/*`).
- **FR-007**: The system MUST handle debouncing to prevent multiple concurrent extractions across all Yahoo Mail injection points.

### Key Entities *(include if feature involves data)*

- **EmailData**: The existing structured representation of an extracted email, which must be reused without modification for Yahoo Mail payloads.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The extension successfully injects the shield icon in Yahoo Mail's standard and raw views on 95% of attempts.
- **SC-002**: Extraction in Yahoo Mail successfully captures all required fields (sender, receivers, subject, date, body text/raw text) matching the Gmail success rate.
- **SC-003**: Logged output for Yahoo Mail extractions is structurally identical to Gmail extractions.
- **SC-004**: Zero regressions in the existing Gmail extraction functionality.
