# Implementation Plan: Optimize Data Extraction

**Branch**: `001-optimize-data-extraction` | **Date**: 2026-03-09 | **Spec**: [specs/001-optimize-data-extraction/spec.md](spec.md)
**Input**: Feature specification from `/specs/001-optimize-data-extraction/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

This feature involves parsing and optimizing email data directly within the Chrome Extension's Content Script context to minimize payload sizes before they are transferred out of the secure perimeter. Cryptographic signatures are explicitly dropped, the body text is forcibly truncated to 1000 characters with whitespaces properly normalized, and URLs are deduplicated and extracted from the raw body replacing their inline counterparts with a `[LINK]` placeholder.

## Technical Context

**Language/Version**: TypeScript (Manifest V3 compatible)
**Primary Dependencies**: None (vanilla regex and DOM operations to meet performance budget)
**Storage**: None beyond transient Memory during extraction
**Testing**: Vitest with mocked raw email DOM / header strings
**Target Platform**: Google Chrome
**Project Type**: Browser Extension (Content Script)
**Performance Goals**: <50ms per extraction, <1MB total extension footprint
**Constraints**: Must never persist raw email data, Must operate entirely locally within the DOM before hitting Network/communication boundaries
**Scale/Scope**: Impacts all opened emails under the `.gmail` host context. Output ensures minimized payloads regardless of original email size.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Security-First**: Passed. The entire crux of this feature minimizes raw email data and excludes cryptographic signatures from ever leaving local bounds.
- **II. Chrome Extension API Compliance**: Passed. Fits perfectly in the MV3 Content Script without requesting new permissions.
- **III. Separation of Concerns**: Passed. Processing occurs explicitly in the Extraction layer prior to touching the Communication layer or Svelte UI.
- **IV. Lightweight & Performant**: Passed. The parser uses vanilla Regex and string manipulation directly targeted at hitting the `<50ms` and `<1MB` constraints natively.
- **V. User Privacy & Transparency**: Passed. This feature drastically decreases the privacy footprint by keeping unneeded data confined locally.
- **VI. Clear & Immediate UX Feedback**: Passed. As an internal extraction performance feature, it executes rapidly (<50ms) effectively preventing UI sluggishness.

## Project Structure

### Documentation (this feature)

```text
specs/001-optimize-data-extraction/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── ProcessedEmailData.ts
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
CheckMailPlugin/
├── src/
│   ├── content/
│   │   ├── index.ts                    # Existing entry point (MutationObserver setup)
│   │   ├── email-extractor.ts          # Existing simplified extraction (to be updated)
│   │   ├── show-original-extractor.ts  # Existing raw MIME parser (to be updated)
│   │   ├── email-data-optimizer.ts     # NEW: Header filtering, verdict parsing, body optimization
│   │   └── __tests__/
│   │       └── email-data-optimizer.test.ts  # NEW: Vitest suite for optimizer
│   ├── shared/
│   │   └── types.ts                    # Existing message payload type (to be updated)
│   └── types/
│       └── email.ts                    # Existing email types (ProcessedEmailData added here)
```

**Structure Decision**: The optimization logic is a new module `email-data-optimizer.ts` co-located with the existing extractors. It receives an `ExtendedEmailData` or `EmailData` and produces a `ProcessedEmailData`. The new type is added to the existing `src/types/email.ts`. Tests use Vitest's default include pattern via a co-located `__tests__/` directory.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*(No violations. Core mechanics elegantly align with the active Constitution constraints).*
