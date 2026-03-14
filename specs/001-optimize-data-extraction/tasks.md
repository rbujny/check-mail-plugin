# Implementation Tasks: Optimize Data Extraction

**Branch**: `001-optimize-data-extraction` | **Date**: 2026-03-09
**Input**: Generated from `plan.md`, `spec.md`, `data-model.md`, `contracts/`, `research.md`, `quickstart.md`

## Phase 1: Setup & Foundational
**Goal**: Establish the new type and optimizer module scaffolding within the existing codebase.
**Independent Test**: The types compile via `npm run check` and a placeholder Vitest suite runs green.

- [x] T001 Add `ProcessedEmailData` interface to existing type file `src/types/email.ts`
- [x] T002 Create optimizer module `src/content/email-data-optimizer.ts` exporting placeholder functions (`optimizeHeaders`, `parseSecurityVerdicts`, `optimizeBody`, `optimizeEmailData`)
- [x] T003 Create test suite `src/content/__tests__/email-data-optimizer.test.ts` with placeholder describe blocks

## Phase 2: User Story 1 - Secure Header Processing (P1)
**Goal**: Extract only necessary email headers (To, From, Subject, Reply-To, Received chain) and parse security verdicts locally, dropping raw cryptographic signatures.
**Independent Test**: Execute the `optimizeHeaders` and `parseSecurityVerdicts` functions against a mock raw headers object and confirm the output contains only allowed headers, the Received chain, and parsed string verdicts — with zero cryptographic keys.

- [x] T004 [US1] Implement `optimizeHeaders` function in `src/content/email-data-optimizer.ts` to filter headers to only To, From, Subject, Reply-To, and Received chain
- [x] T005 [US1] Implement `parseSecurityVerdicts` function in `src/content/email-data-optimizer.ts` to extract SPF, DKIM, DMARC verdicts from the `authentication-results` header string
- [x] T006 [P] [US1] Write test cases in `src/content/__tests__/email-data-optimizer.test.ts` for header filtering and verification that cryptographic signatures (arc-seal, dkim-signature) are excluded
- [x] T007 [P] [US1] Write test cases in `src/content/__tests__/email-data-optimizer.test.ts` for accurate SPF, DKIM, DMARC verdict parsing

## Phase 3: User Story 2 - Minimalist Body Text Extraction (P1)
**Goal**: Extract all URLs into a separate deduplicated list, replace them with `[LINK]`, normalize whitespace, and truncate to 1000 characters.
**Independent Test**: Execute `optimizeBody` against a mock long string with excess whitespace and multiple links; output should contain ≤1000 chars, `[LINK]` replacements, and a deduplicated link array.

- [x] T008 [US2] Implement URL extraction and deduplication in `src/content/email-data-optimizer.ts` using regex pattern `https?:\/\/[^\s<>"')\]]+`
- [x] T009 [US2] Implement `optimizeBody` in `src/content/email-data-optimizer.ts` (replace URLs with `[LINK]`, normalize whitespace, truncate to 1000 chars)
- [x] T010 [P] [US2] Write test cases for URL extraction and deduplication in `src/content/__tests__/email-data-optimizer.test.ts`
- [x] T011 [P] [US2] Write test cases for whitespace normalization and 1000-char truncation in `src/content/__tests__/email-data-optimizer.test.ts`

## Phase 4: Edge Cases
**Goal**: Cover all edge cases identified in the specification to prevent silent failures.
**Independent Test**: Each edge-case test can be run independently via Vitest and asserts graceful handling.

- [x] T012 [P] [US1] Write test case in `src/content/__tests__/email-data-optimizer.test.ts` for malformed or partial `authentication-results` header (e.g., only SPF, no DKIM)
- [x] T013 [P] [US2] Write test case in `src/content/__tests__/email-data-optimizer.test.ts` for email body composed entirely of URLs
- [x] T014 [P] [US2] Write test case in `src/content/__tests__/email-data-optimizer.test.ts` for malformed or multi-line URLs
- [x] T015 [P] [US1] Write test case in `src/content/__tests__/email-data-optimizer.test.ts` for missing targeting headers (e.g., no Reply-To or no To field)

## Phase 5: Integration & Validation
**Goal**: Wire the optimizer into the existing extraction flow and validate all success criteria.
**Independent Test**: Running the full build and test suite (`npm run check` + `vitest`) passes. Payload measurements confirm SC-001 and SC-004.

- [x] T016 Integrate `optimizeEmailData` into `src/content/show-original-injector.ts` to run extracted data through optimizer before passing to Communication layer
- [x] T017 Update `src/content/icon-injector.ts` to run extracted data through optimizer before passing to Communication layer
- [x] T018 Update Chrome Message Passing payload typing in `src/shared/types.ts` to use `ProcessedEmailData`
- [x] T019 Write integration test in `src/content/__tests__/email-data-optimizer.test.ts` asserting payload size reduction ≥50% compared to raw input (SC-001)
- [x] T020 Write performance benchmark test in `src/content/__tests__/email-data-optimizer.test.ts` asserting extraction completes in <50ms (SC-004)
- [x] T021 Run full `npm run check` and `vitest` suite to verify TS compliance and all logic constraints

## Dependencies & Execution Order

- **Foundational**: Phase 1 MUST be completed before User Stories.
- **User Story 1 & 2**: Can be developed entirely in parallel once Phase 1 is complete.
- **Edge Cases**: Phase 4 can run in parallel with Phase 3, after Phase 2 implementation tasks (T004, T005) are complete.
- **Integration**: Phase 5 MUST wait until all Phase 2, 3, and 4 tests pass.

## Implementation Strategy

We will deliver this feature iteratively:
- First, establishing the type and module scaffolding within the existing codebase (Phase 1).
- Then, building out the independent parsing pipelines concurrently mapped to User Stories 1 and 2.
- Edge-case coverage runs in parallel once core parsing functions exist.
- Finally, wiring the optimizer into both extraction paths (`email-extractor.ts` and `show-original-extractor.ts`) and validating all success criteria including the 50% payload reduction and <50ms performance budgets.
