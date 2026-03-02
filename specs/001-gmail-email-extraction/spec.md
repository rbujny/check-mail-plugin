# Feature Specification: Gmail Email Extraction

**Feature Branch**: `001-gmail-email-extraction`
**Created**: 2026-02-28
**Status**: Draft
**Input**: User description: "Start from creating plugin from scratch. Add icon near print all / in new window while reading mail in Gmail. On click, download visible mail content (simplified version without headers) and log it in a dedicated place to verify correctness."

## Clarifications

### Session 2026-02-28

- Q: In a thread with multiple expanded messages, which message should the icon extract? → A: Inject a separate icon per message in the thread so the user can check each one individually.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scan Email Button (Priority: P1)

A user is reading an email in Gmail. They notice a small, recognizable
CheckMailPlugin icon in the email toolbar — positioned near the existing
"Print all" and "Open in new window" action buttons. The icon blends
with Gmail's native UI so it feels like a first-class feature rather
than an afterthought.

**Why this priority**: This is the fundamental entry point to the entire
extension. Without an in-context trigger inside Gmail, users have no way
to initiate an email scan. Everything else depends on this button
existing and being discoverable.

**Independent Test**: Can be fully tested by opening any email in Gmail,
confirming the icon appears in the toolbar, and verifying it is
clickable. Delivers value by proving the content script successfully
injects UI into Gmail's DOM.

**Acceptance Scenarios**:

1. **Given** the user has the extension installed and opens a single
   email (not a thread) in Gmail, **When** the email view loads,
   **Then** the CheckMailPlugin icon MUST appear in the toolbar area
   near the "Print all" and "Open in new window" buttons within
   2 seconds of the email rendering.
2. **Given** the user opens a thread containing multiple messages,
   **When** the thread view loads, **Then** a separate CheckMailPlugin
   icon MUST appear for each expanded message in the thread.
3. **Given** the user navigates away from an email and opens a different
   email, **When** the new email view loads, **Then** the icon(s) MUST
   appear again for the new email (no stale icons left behind).
4. **Given** the user is on the inbox list view (no email open),
   **When** they look at the page, **Then** the CheckMailPlugin icon
   MUST NOT be visible (it only appears inside an open email view).
5. **Given** the user hovers over any icon instance, **When** the cursor
   is over it, **Then** a tooltip reading "Scan with CheckMail" MUST
   appear.

---

### User Story 2 - Extract Email Content (Priority: P1)

A user clicks the CheckMailPlugin icon while reading an email. The
extension extracts all visible content from the email — including the
subject line, sender, recipients, date, and full body text. Raw email
headers (DKIM, DMARC, SPF, etc.) are explicitly out of scope for this
feature and will be addressed in a future iteration.

**Why this priority**: Extraction is the core data pipeline. Without
reliable data extraction, there is nothing to send to the backend API
in future features.

**Independent Test**: Can be fully tested by clicking the icon on
several different emails (plain text, HTML-rich, emails with
attachments, forwarded threads) and verifying the extracted data
contains all expected fields. Delivers value by proving end-to-end
data capture.

**Acceptance Scenarios**:

1. **Given** the user is reading a standard email and clicks the icon,
   **When** extraction finishes, **Then** the extracted data MUST
   contain at minimum: sender (From), recipients (To, Cc if present),
   subject, date, and full body text.
2. **Given** the user is reading a thread with multiple messages and
   clicks the icon next to a specific message, **When** extraction
   finishes, **Then** the extension MUST extract only that specific
   message's content — not other messages in the thread.
3. **Given** the email contains HTML formatting (bold, links, images),
   **When** extraction happens, **Then** the body MUST be captured as
   plain text with meaningful structure preserved (e.g., line breaks
   for paragraphs, link URLs retained).

---

### User Story 3 - Log Extracted Data for Inspection (Priority: P1)

After extraction completes, the extension writes the extracted email
data to a dedicated, inspectable log — the browser's Developer Tools
console under a clearly labeled group. The user (developer/tester) can
open DevTools and review the full extraction output to verify
correctness before any backend integration is built.

**Why this priority**: This is the verification mechanism for the entire
extraction pipeline. Without logging, there is no way to confirm that
extraction works correctly. This is explicitly requested by the user as
the validation step.

**Independent Test**: Can be fully tested by clicking the icon, opening
DevTools → Console, and verifying a structured log entry appears with
all extracted fields. Delivers value by providing immediate developer
feedback without requiring any backend.

**Acceptance Scenarios**:

1. **Given** the user clicks the icon and extraction succeeds, **When**
   the log is written, **Then** a console group titled
   `[CheckMailPlugin] Email Extraction` MUST appear in DevTools with
   the full extracted data formatted as a readable object.
2. **Given** extraction succeeds, **When** the user inspects the log,
   **Then** the logged object MUST include a `timestamp` field showing
   when the extraction occurred and a `source` field identifying the
   email (e.g., subject line or message ID).
3. **Given** extraction encounters a partial failure (e.g., a field
   could not be found in the DOM), **When** the log is written,
   **Then** a warning-level message MUST appear indicating which
   fields could not be extracted, alongside the successfully extracted
   data.
4. **Given** the user clicks the icon multiple times on different
   emails, **When** they check the console, **Then** each extraction
   MUST appear as a separate, timestamped log group — never
   overwriting previous entries.

---

### User Story 4 - Extension Installation & Setup (Priority: P2)

A developer or tester downloads the extension source code, runs the
build process, and sideloads the extension into Chrome. The extension
installs without errors, requests only the necessary permissions, and
is immediately ready to use on Gmail without additional configuration.

**Why this priority**: Installation is a prerequisite, but it is
lower priority because it is a one-time developer workflow step, not
a user-facing feature per se.

**Independent Test**: Can be fully tested by following the README
instructions to build and sideload the extension, then navigating to
Gmail to verify the extension is active.

**Acceptance Scenarios**:

1. **Given** a developer clones the repository and runs the build
   command, **When** the build completes, **Then** a loadable
   extension directory MUST be produced with a valid `manifest.json`.
2. **Given** the developer sideloads the built extension in Chrome,
   **When** they navigate to Gmail, **Then** the extension MUST
   activate without console errors and the content script MUST inject
   successfully.
3. **Given** the extension is installed, **When** the user reviews
   the permissions in Chrome's extension manager, **Then** only
   permissions scoped to `mail.google.com` MUST be listed — no
   broad or unnecessary permissions.

---

### Edge Cases

- What happens when Gmail's DOM structure changes (e.g., after a Gmail
  update)? The extension MUST fail gracefully — the icon simply does
  not appear, and an error is logged to the console. It MUST NOT break
  Gmail's UI or cause visible errors to the user.
- What happens when the user opens Gmail in a locale other than English?
  The icon injection MUST NOT depend on locale-specific text labels in
  the DOM; it MUST use structural selectors or attribute-based
  selectors.
- What happens when the user has multiple Gmail tabs open? Each tab
  MUST operate independently — clicking the icon in one tab MUST NOT
  affect another tab.
- What happens when the email body is empty? The extension MUST still
  extract available metadata (sender, subject, date) and log the body
  as empty.
- What happens when the user is in Gmail's "preview pane" reading mode?
  The icon injection MUST work in both the default full-view and the
  preview pane layout.
- What happens when a message in a thread is collapsed (not expanded)?
  The icon MUST NOT appear for collapsed messages. When the user expands
  a collapsed message, the icon MUST be injected dynamically.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST inject a clickable icon into each
  individual expanded message's toolbar area in Gmail, positioned near
  the "Print all" and "Open in new window" buttons. In a thread, each
  expanded message MUST have its own icon.
- **FR-002**: The icon MUST only appear when an email is open for
  reading — it MUST NOT appear on the inbox list view, settings pages,
  or compose windows.
- **FR-003**: The extension MUST observe DOM changes (e.g., via
  MutationObserver) to detect when a new email is opened or a collapsed
  message in a thread is expanded, and inject the icon dynamically.
- **FR-004**: On icon click, the extension MUST extract the following
  fields from the currently visible email: sender (From), recipients
  (To, Cc), subject, date, and full body text.
- **FR-005**: Extracted email data MUST be logged to the browser's
  Developer Tools console as a structured, collapsible console group
  with a clear label and timestamp.
- **FR-006**: The extension MUST provide visual feedback on the icon
  (e.g., brief color change or animation) when extraction is in
  progress and when it completes.
- **FR-007**: The extension MUST use a Manifest V3 configuration with
  permissions scoped exclusively to `https://mail.google.com/*`.
- **FR-008**: The icon MUST include a tooltip ("Scan with CheckMail")
  visible on hover.
- **FR-009**: The extension MUST NOT persist any email data to local
  storage, extension storage, or any other durable store. All extracted
  data is ephemeral (console log only).
- **FR-010**: The extension MUST clean up injected icons when the user
  navigates away from an email view to prevent duplicate or orphaned
  icons. When a thread message is collapsed, its associated icon MUST
  be removed.

### Key Entities

- **EmailData**: The structured representation of an extracted email.
  Contains fields: `from`, `to`, `cc`, `subject`, `date`, `bodyText`,
  and `extractionTimestamp`.
- **ExtractionResult**: Wraps an `EmailData` with metadata about the
  extraction: `success` (boolean), `warnings` (list of strings for
  missing fields), and `source` (identifier for the email, e.g.,
  subject or message ID).

### Assumptions

- Gmail's web interface is the only supported email client for this
  feature. No other webmail providers are in scope.
- The extension operates entirely client-side for this feature — there
  is no backend API communication yet.
- Raw email headers (DKIM, DMARC, SPF) are explicitly **out of scope**
  for this feature. Header extraction will be addressed in a future
  iteration, likely via Gmail API integration.
- The extension targets the standard Gmail web interface at
  `mail.google.com`, not the basic HTML version.
- The "dedicated place" for logging is the browser DevTools console.
  A future feature may add a dedicated panel or popup view.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The scan icon appears within 2 seconds of opening any
  email in Gmail, on 95% of email opens (accounting for network/DOM
  variability).
- **SC-002**: Extraction captures sender, recipients, subject, date,
  and body text for 100% of standard emails (plain text and HTML).
- **SC-003**: A developer can verify extraction correctness by reading
  the console log within 10 seconds of clicking the icon.
- **SC-004**: The extension installs and runs without errors when
  sideloaded, requiring no manual configuration beyond the standard
  build step.
- **SC-005**: The extension causes no visible degradation to Gmail's
  page load time or interaction responsiveness (no main-thread blocks
  exceeding 50 ms).
