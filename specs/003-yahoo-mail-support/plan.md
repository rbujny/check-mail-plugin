# Implementation Plan: Yahoo Mail Support

**Branch**: `003-yahoo-mail-support` | **Date**: 2026-03-15 | **Spec**: [specs/003-yahoo-mail-support/spec.md](../spec.md)
**Input**: Feature specification from `/specs/003-yahoo-mail-support/spec.md`

## Summary

Expand CheckMailPlugin to support Yahoo Mail (`mail.yahoo.com`). This involves porting the existing Gmail extraction logic (both simplified standard view and raw source view) to the Yahoo Mail DOM. We will maintain the same ephemeral data pipeline, standardized `EmailData` structure, and unified logging mechanism.

## Technical Context

**Language/Version**: TypeScript (strict mode)
**Primary Dependencies**: Vite, CRXJS, Svelte 5
**Storage**: N/A (Ephemeral processing only)
**Testing**: Vitest
**Target Platform**: Chrome (Manifest V3)
**Project Type**: Chrome Extension
**Performance Goals**: Icon injection < 2s; Main thread block < 50ms
**Constraints**: Bundle size < 1MB; Ephemeral processing (no persistence)
**Scale/Scope**: Yahoo Mail (standard and raw views)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Security-First | No persistent storage; HTTPS only (implied by browser). | ✅ Pass |
| II. Extension API Compliance | Manifest V3; narrow host permissions (`mail.yahoo.com`). | ✅ Pass |
| III. Separation of Concerns | Distinct extraction layer for Yahoo Mail selectors. | ✅ Pass |
| IV. Lightweight & Performant | Minimize DOM mutation overhead; keep bundle < 1MB. | ✅ Pass |
| V. Privacy & Transparency | Ephemeral processing; visible UI indicator. | ✅ Pass |
| VI. Clear UX Feedback | Tooltips and visual feedback on shield icon. | ✅ Pass |

## Project Structure

### Documentation (this feature)

```text
specs/003-yahoo-mail-support/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
└── quickstart.md        # Phase 1 output
```

### Source Code (repository root)

```text
src/
├── content/
│   ├── index.ts                 # Main entry (Gmail)
│   ├── yahoo/                   # New: Yahoo Mail specific extraction
│   │   ├── index.ts             # Yahoo Mail entry point
│   │   ├── yahoo-injector.ts    # DOM injection for Yahoo
│   │   └── yahoo-extractor.ts   # DOM parsing for Yahoo
│   ├── show-original-injector.ts # Gmail Raw view
│   ├── show-original-extractor.ts # Gmail Raw view
│   ├── icon-injector.ts         # Shared injection utilities
│   └── email-extractor.ts       # Shared parsing logic
├── utils/
│   ├── mime-parser.ts           # Shared MIME parsing
│   └── sanitizer.ts             # Shared sanitization
public/
└── manifest.json             # Update with Yahoo host permissions
```

**Structure Decision**: Option 1 (Single project). We will introduce a `yahoo/` subdirectory within `src/content` to encapsulate the Yahoo-specific logic while sharing the core extraction and utility modules.

## Complexity Tracking

*No current violations of the constitution.*
