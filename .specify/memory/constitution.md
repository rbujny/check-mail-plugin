<!--
  Sync Impact Report
  ───────────────────
  Version change: 1.0.0 → 1.1.0 (material expansion of performance constraint)

  Added sections: none

  Removed sections: none

  Modified principles:
    - IV. Lightweight & Performant: Updated total bundled extension size limit from 500 KB to 1 MB.

  Templates requiring updates:
    ✅ plan.md   — Updated Constraint "Bundle < 500KB" to "Bundle < 1MB"
    ✅ spec.md   — no change required
    ✅ tasks.md  — no change required

  Follow-up TODOs: none
-->

# CheckMailPlugin Constitution

## Core Principles

### I. Security-First

All code that handles email content, authentication tokens, or
communication with external services MUST treat security as the
highest priority.

- Raw email data (headers, body, attachments metadata) MUST NEVER be
  persisted to local storage or extension storage beyond the lifetime
  of a single analysis request.
- Every outbound HTTP request MUST use HTTPS exclusively; plain HTTP
  endpoints MUST be rejected at the network layer.
- API keys, tokens, and secrets MUST NEVER be hard-coded in source
  files. They MUST be injected via environment variables at build time
  or retrieved from a secure backend handshake.
- Content Security Policy (CSP) declarations in `manifest.json` MUST
  follow the principle of least privilege — only the backend API
  origin is whitelisted for `connect-src`.

**Rationale**: The extension operates inside a user's email client
and has access to highly sensitive data. A single leak or
misconfiguration can expose private communications.

### II. Chrome Extension API Compliance

The extension MUST conform to Chrome Web Store policies and Manifest
V3 requirements at all times.

- The extension MUST use Manifest V3 (`"manifest_version": 3`).
- Background processing MUST use a service worker (`background.service_worker`),
  not persistent background pages.
- All required permissions MUST be declared in `manifest.json` with
  clear justification comments in the codebase. No unnecessary
  permissions are allowed.
- Content scripts MUST be scoped to the narrowest possible URL
  patterns (e.g., `https://mail.google.com/*`) — never `<all_urls>`.
- Message passing between content scripts, popup, and service worker
  MUST use `chrome.runtime.sendMessage` / `chrome.runtime.onMessage`
  with strictly typed message payloads.

**Rationale**: Non-compliant extensions are rejected from the Chrome
Web Store and can be disabled by Chrome updates without notice.

### III. Separation of Concerns

The codebase MUST maintain a clear boundary between three layers:
**Extraction**, **Communication**, and **Presentation**.

- **Extraction layer** — content scripts and DOM parsers that
  retrieve email content and raw headers from Gmail's UI or via the
  Gmail API. This layer MUST NOT contain any UI logic.
- **Communication layer** — service worker and API client modules
  that serialize extracted data, send it to the backend, and
  deserialize the response. This layer MUST NOT access the DOM.
- **Presentation layer** — Svelte components rendered in the popup
  or injected sidebar that display results to the user. This layer
  MUST NOT make direct HTTP calls or parse raw email data.

Each layer MUST be independently testable. Cross-layer communication
MUST use typed message interfaces defined in a shared `types/`
directory.

**Rationale**: Chrome extensions inherently run code in multiple
isolated contexts (content script, service worker, popup). Enforcing
separation prevents coupling that makes debugging and testing nearly
impossible.

### IV. Lightweight & Performant

The extension MUST remain lightweight so it does not degrade the
host page (Gmail) performance.

- The total bundled extension size MUST stay below 1 MB (excluding
  source maps).
- Content scripts MUST NOT block the main thread for more than 50 ms
  during email extraction.
- Network requests to the backend API MUST implement a timeout of
  30 seconds with clear user feedback on timeout.
- The popup UI MUST render to first meaningful paint in under 200 ms.
- Third-party runtime dependencies MUST be kept to the absolute
  minimum. Any new dependency MUST be justified in the PR
  description.

**Rationale**: Users will uninstall an extension that slows down
their email client. Chrome also flags extensions with excessive
resource usage.

### V. User Privacy & Transparency

Users MUST understand and control what data leaves their browser.

- The extension MUST display a clear, non-dismissible consent prompt
  on first use explaining what email data is sent and to whom.
- The extension MUST provide a visible indicator (icon badge or
  in-page element) while email data is being transmitted.
- Email data sent to the backend MUST be limited to the minimum
  required fields: headers (From, To, Subject, DKIM, DMARC, SPF,
  Received chain) and body text. Attachments MUST NOT be uploaded
  unless the user explicitly opts in.
- The extension MUST NOT collect telemetry, analytics, or browsing
  history.

**Rationale**: Handling personal email data carries legal (GDPR) and
ethical obligations. Violating user trust is a terminal reputational
risk.

### VI. Clear & Immediate UX Feedback

The user MUST always know the current state of the phishing analysis.

- Every user-initiated action (scan email, view result) MUST produce
  visible feedback within 300 ms (loading spinner, status change, or
  result display).
- The final verdict MUST be presented as a binary, unambiguous label:
  **Safe** (with a green visual cue) or **Phishing** (with a red
  visual cue), accompanied by a brief explanation from the LLM.
- Error states (network failure, API error, timeout) MUST be
  communicated with actionable messages — never silent failures.
- The UI MUST be accessible: minimum WCAG 2.1 AA contrast ratios,
  keyboard-navigable, and screen-reader-friendly labels on all
  interactive elements.

**Rationale**: The extension exists to protect users from phishing.
Ambiguous or missing feedback defeats its entire purpose.

## Technology Constraints

- **Runtime**: Google Chrome (Manifest V3 extension)
- **Language**: TypeScript (strict mode enabled)
- **Framework**: Svelte 5 (compiled via `@sveltejs/vite-plugin-svelte`)
- **Bundler**: Vite 7 with `@crxjs/vite-plugin` for Chrome extension
  output
- **Styling**: Vanilla CSS scoped within Svelte components; no CSS
  framework unless explicitly approved
- **Testing**: Vitest for unit tests; Playwright or Puppeteer for
  end-to-end extension testing (when added)
- **Linting**: ESLint + `svelte-check` (`npm run check`)
- **Target Browsers**: Google Chrome (latest stable) — other
  Chromium browsers are a non-goal for v1
- **Backend contract**: The extension communicates with a single
  backend API endpoint; API schema changes MUST be versioned and
  backward-compatible on the backend side

## Development Workflow

- **Branching**: Feature branches off `main`; branch names follow
  the pattern `<issue-number>-<short-description>`.
- **Commits**: Conventional Commits format
  (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`).
- **Code review**: Every PR MUST be reviewed before merge. The
  reviewer MUST verify compliance with this constitution's
  principles.
- **Build verification**: `npm run check` and `npm run build` MUST
  pass with zero errors and zero warnings before a PR can be merged.
- **Manual QA**: Before each release, the extension MUST be
  sideloaded and tested against a real Gmail inbox with at least one
  known-phishing and one known-safe email.

## Governance

This constitution is the supreme governing document for the
CheckMailPlugin project. All code, documentation, and process
decisions MUST comply with the principles defined herein.

- **Amendments**: Any change to this constitution MUST be proposed
  as a PR, reviewed, and approved. The PR description MUST explain
  the rationale and the impact on existing code.
- **Versioning**: The constitution follows Semantic Versioning:
  - MAJOR — principle removed or redefined in a backward-incompatible
    way.
  - MINOR — new principle or section added, or material expansion of
    existing guidance.
  - PATCH — clarifications, wording improvements, typo fixes.
- **Compliance review**: At the start of each new feature
  specification (`/speckit.specify`), the spec author MUST verify
  that the feature design does not violate any active principle.
- **Conflict resolution**: If a principle conflicts with a practical
  requirement, the conflict MUST be documented in the Complexity
  Tracking table of the implementation plan with a justification for
  the deviation.

**Version**: 1.1.0 | **Ratified**: 2026-02-28 | **Last Amended**: 2026-02-28
