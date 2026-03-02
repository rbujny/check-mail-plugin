# Tasks: Show Original Email Extraction

**Input**: Design documents from `/specs/002-show-original-extract/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Update `public/manifest.json` to include content script for Gmail's "Show Original" view (`view=om`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [x] T002 Update `src/types/email.ts` to include `ExtractResult` interface and `source` type per `contracts/raw-email.md`
- [x] T003 [P] Update `src/utils/logger.ts` to support size-based thresholds (>5MB warning) and source-specific labels
- [x] T004 Define `ICON_MARKER` and standard styles constants in a shared location if needed, or prepare for reuse across injectors

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Extract Raw Email Data from 'Show Original' View (Priority: P1) 🎯 MVP

**Goal**: Extract complete raw email metadata and payload when clicking a shield icon in the 'Show Original' view.

**Independent Test**: Open 'Show Original' in Gmail, click injected shield, verify full MIME headers and body are logged to console.

### Implementation for User Story 1

- [x] T005 [P] [US1] Create raw text extractor in `src/content/show-original-extractor.ts` to grab `innerText` from `<pre>` blocks
- [x] T005b [P] [US1] Implement MIME parser logic inside `src/content/show-original-extractor.ts` to convert the raw string into an `ExtendedEmailData` structure, mapping required headers and body.
- [x] T006 [P] [US1] Create icon injector skeleton in `src/content/show-original-injector.ts` targeting Gmail header action row
- [x] T007 [US1] Implement click event handler in `src/content/show-original-injector.ts` with `dataset.extracting` debounce lock
- [x] T008 [US1] Integrate `show-original-extractor.ts` with the injector click handler to process and log `ExtractResult`
- [x] T009 [US1] Add graceful failure handling in `show-original-injector.ts` for unfindable DOM elements per `spec.md`

**Checkpoint**: User Story 1 is functional for the raw view extraction.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and existing flows

- [x] T010 Update existing simplified injector `src/content/icon-injector.ts` to implement identical `dataset.extracting` locking logic
- [x] T011 [P] Verify size-based warning logging functions correctly for both simplified and `original` extraction sources
- [x] T012 Run `quickstart.md` validation scenarios to ensure end-to-end consistency

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 completion (for type definitions used in implementation).
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion.
- **Polish (Phase 4)**: Depends on US1 completion.

### Parallel Opportunities

- T003 (Logger) and T004 (Styles) can run in parallel within Phase 2.
- T005 (Extractor) and T006 (Injector Skeleton) can run in parallel within Phase 3.
- T011 (Verification) can run in parallel within Phase 4.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (Manifest update).
2. Complete Phase 2: Foundational (Types and Logger).
3. Complete Phase 3: User Story 1 (Show Original view logic).
4. **STOP and VALIDATE**: Test User Story 1 independently in the browser.

### Incremental Delivery

1. Foundation ready (Phase 1 + 2).
2. Add Raw Extraction (Phase 3) -> Ready for deep analysis MVP.
3. Update Simplified Extraction (Phase 4) -> Ensure parity and robustness across extension.
