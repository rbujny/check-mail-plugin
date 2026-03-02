# Research: Gmail Email Extraction

**Feature**: `001-gmail-email-extraction`
**Date**: 2026-02-28

## R1: Gmail DOM Structure for Icon Injection

**Decision**: Use `MutationObserver` on `document.body` to detect email
view containers, then locate message toolbar elements by structural
position (parent-child relationships and `role`/`data-*` attributes)
rather than CSS class names.

**Rationale**: Gmail's DOM is highly dynamic — class names are
obfuscated and change with Gmail updates. Structural selectors
(e.g., `[role="listitem"]`, `[data-message-id]`, toolbar containers
adjacent to action buttons) are more stable. MutationObserver is the
standard approach for single-page applications where elements load
asynchronously.

**Alternatives considered**:
- **Static CSS selectors**: Too brittle; Gmail frequently changes class
  names. Would require maintenance on every Gmail update.
- **Gmail API via `chrome.identity`**: Would provide reliable access to
  message data but requires OAuth2 setup, additional permissions, and
  is overkill for this MVP phase focused on DOM extraction.
- **`setInterval` polling**: Wasteful and imprecise. MutationObserver
  is the modern, event-driven replacement.

## R2: Chrome Extension Architecture with @crxjs/vite-plugin

**Decision**: Use `@crxjs/vite-plugin` with `manifest.config.ts` for
type-safe manifest generation. Content script is a plain TypeScript
file (not a Svelte component) since it only injects a small icon into
the host page DOM. The popup UI (if needed later) will use Svelte
components.

**Rationale**: `@crxjs/vite-plugin` handles HMR for content scripts,
automatic manifest generation, and correct bundling for Manifest V3.
The content script itself does not need a framework — it creates a
single button element and attaches event listeners. Svelte would add
unnecessary overhead for a single DOM element injection.

**Alternatives considered**:
- **Manual Vite config for extension**: Requires custom rollup
  configurations for multiple entry points. CRXJS abstracts this.
- **Svelte content script with Shadow DOM**: Provides component
  encapsulation but is overkill for a single icon button. Shadow DOM
  also complicates styling to match Gmail's native look.
- **Webpack-based extension tooling**: Slower builds, less HMR support
  compared to Vite + CRXJS.

## R3: Email Content Extraction Strategy

**Decision**: Extract email metadata from DOM elements within each
individual message container. Identify message containers by their
structural markers (nested inside conversation view, each having its
own header block with sender/date and body section). Extract body text
using `innerText` (which respects CSS visibility and produces
human-readable output with line breaks).

**Rationale**: `innerText` preserves paragraph breaks and ignores
hidden elements (unlike `textContent`). For link URLs, a preprocessing
step will convert `<a>` tags to include the href in parentheses before
text extraction, e.g., `Link Text (https://example.com)`.

**Alternatives considered**:
- **`textContent`**: Preserves all text including hidden elements;
  loses line break structure. Not suitable for readable output.
- **`innerHTML` + DOM-to-text library**: Adds a dependency. Custom
  preprocessing is simpler for this scope.
- **Gmail API `messages.get`**: Would provide exact message data but
  requires OAuth2 and API integration (deferred to future feature).

## R4: Content Script Injection Scope

**Decision**: Declare content script in manifest with
`matches: ["https://mail.google.com/*"]` and `run_at: "document_idle"`.
Use MutationObserver immediately on load to watch for email view DOM
changes.

**Rationale**: `document_idle` ensures the initial DOM is ready before
the script executes. Gmail loads as a single-page app, so the
MutationObserver handles all subsequent view transitions without
needing to re-inject the content script.

**Alternatives considered**:
- **`document_start`**: Script runs too early; DOM not ready.
- **`document_end`**: DOM structure exists but Gmail's dynamic content
  may not have loaded yet. Still requires MutationObserver, so no
  advantage over `document_idle`.
- **Programmatic injection via `chrome.scripting.executeScript`**:
  Requires `activeTab` permission or broader host permissions. Static
  declaration is simpler and more predictable.

## R5: Logging Strategy

**Decision**: Use `console.group` / `console.groupCollapsed` /
`console.groupEnd` to create labeled, collapsible log entries.
Structure each entry as a JSON-serializable object logged via
`console.log` inside the group. Warnings use `console.warn`.

**Rationale**: Native console grouping is the most developer-friendly
approach — no external dependencies, works in all Chrome DevTools, and
provides exactly the structured, inspectable output the spec requires.

**Alternatives considered**:
- **Custom DevTools panel**: Requires a separate extension page and
  `devtools_page` manifest entry. Significant scope increase for this
  MVP.
- **Extension popup log viewer**: Would need persist data to
  `chrome.storage`. Violates FR-009 (no data persistence).
- **`console.table`**: Good for tabular data but doesn't handle nested
  objects (like email body text) well.
