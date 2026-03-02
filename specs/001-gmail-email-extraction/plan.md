# Implementation Plan: Gmail Email Extraction

**Branch**: `001-gmail-email-extraction` | **Date**: 2026-02-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-gmail-email-extraction/spec.md`

## Summary

Build a Chrome extension from scratch that injects a clickable icon
into Gmail's email view toolbar (one per expanded message in a thread).
On click, the icon triggers extraction of visible email metadata (From,
To, Cc, Subject, Date) and body text from the DOM. Extracted data is
logged to the browser's DevTools console as a structured, collapsible
group for developer inspection. No backend communication or data
persistence — purely client-side DOM extraction and console output.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode)
**Primary Dependencies**: Svelte 5.45, Vite 7.3, `@crxjs/vite-plugin` 1.0, `@sveltejs/vite-plugin-svelte` 6.2
**Storage**: N/A (no data persistence — FR-009)
**Testing**: Manual sideload testing against live Gmail (automated testing deferred)
**Target Platform**: Google Chrome (latest stable), Manifest V3 extension
**Project Type**: Chrome extension (browser-extension)
**Performance Goals**: Icon injection < 2s (SC-001); no main-thread blocks > 50ms (SC-005); popup FMP < 200ms (constitution)
**Constraints**: Bundle < 1MB (constitution); permissions scoped to `mail.google.com` only (FR-007); no data persistence (FR-009)
**Scale/Scope**: Single-user client-side tool; 1 content script; 1 service worker (minimal); no popup UI in this feature

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I. Security-First** | ✅ PASS | No data persistence (FR-009); no outbound HTTP; no secrets; content script scoped to `mail.google.com` |
| **II. Chrome Extension API Compliance** | ✅ PASS | Manifest V3 (FR-007); service worker background; permissions scoped to `https://mail.google.com/*`; content script URL pattern narrowly scoped |
| **III. Separation of Concerns** | ✅ PASS | Extraction layer = content script (DOM parsing, no UI logic beyond icon injection); Communication layer = N/A (no backend); Presentation = N/A (no popup UI in this feature); typed interfaces in `src/types/` |
| **IV. Lightweight & Performant** | ✅ PASS | No runtime dependencies beyond Chrome APIs; MutationObserver is async/non-blocking; `innerText` extraction is synchronous but fast (< 50ms for typical emails) |
| **V. User Privacy & Transparency** | ✅ PASS | No data leaves the browser; no persistence; no telemetry; console-only output |
| **VI. Clear & Immediate UX Feedback** | ✅ PASS | Icon visual feedback on extraction (FR-006); structured console output (FR-005); warning-level messages for partial failures |

**Gate result**: ALL PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-gmail-email-extraction/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research output
├── data-model.md        # Phase 1 data model
├── quickstart.md        # Phase 1 quickstart guide
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── content/
│   ├── index.ts              # Content script entry point (MutationObserver setup)
│   ├── icon-injector.ts      # Icon injection into Gmail toolbar(s)
│   └── email-extractor.ts    # DOM extraction logic for email fields
├── types/
│   └── email.ts              # EmailData and ExtractionResult interfaces
├── utils/
│   └── logger.ts             # Console group logging utility
├── assets/
│   └── icon.svg              # CheckMailPlugin toolbar icon (shield)
├── App.svelte                # Popup component (unused in this feature, placeholder)
├── app.css                   # Global styles (unused in this feature)
├── main.ts                   # Popup entry point (unused in this feature)
└── lib/
    └── Counter.svelte        # Scaffolding (can be removed)

public/
└── vite.svg                  # Default Vite asset (can be removed)

manifest.config.ts             # Type-safe manifest definition for CRXJS
```

**Structure Decision**: Chrome extension with single content script
entry point. The content script is vanilla TypeScript (no Svelte) since
it only injects a small icon element into the host page DOM. The
existing popup scaffolding (App.svelte, main.ts) is preserved but
unused in this feature. All extraction types live in `src/types/` for
cross-module sharing per Constitution Principle III.

## Complexity Tracking

> No constitution violations — this table is intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| *(none)*  | —          | —                                    |
