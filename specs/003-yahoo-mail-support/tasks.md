# Tasks: Yahoo Mail Support

**Input**: Design documents from `/specs/003-yahoo-mail-support/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initial configuration to support Yahoo Mail domain.

- [x] T001 Update `public/manifest.json` to include `https://mail.yahoo.com/*` in `host_permissions`
- [x] T002 Update `public/manifest.json` `content_scripts` to include a single entry for Yahoo Mail (`https://mail.yahoo.com/*`) covering both standard and raw views
- [x] T003 [P] Create directory structure at `src/content/yahoo/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared utilities required for Yahoo-specific extraction.

- [x] T004 [P] Verify `src/content/icon-injector.ts` handles generic injection markers used by the new Yahoo content script
- [x] T005 [P] Ensure `src/types/email.ts` is exported and ready for use in new Yahoo modules

**Checkpoint**: Foundation ready - Yahoo-specific implementation can begin.

---

## Phase 3: User Story 1 - Scan Email Button in Yahoo Mail (Priority: P1) 🎯 MVP

**Goal**: Inject a scan button into the Yahoo Mail toolbar and extract simplified email data (sender, subject, body).

**Independent Test**: Open a standard email in Yahoo Mail, click the injected shield icon, and verify the structured log in the console.

### Implementation for User Story 1

- [x] T006 [P] [US1] Implement `src/content/yahoo/yahoo-extractor.ts` with selectors for subject, sender, and body using `data-test-id`
- [x] T007 [US1] Implement `src/content/yahoo/yahoo-injector.ts` to find `[data-test-id="toolbar"]` and append the shield icon
- [x] T008 [US1] Create entry point at `src/content/yahoo/index.ts` to initialize `MutationObserver` and trigger injection on standard view
- [x] T009 [US1] Integrate `yahoo-extractor.ts` with the button click handler in `yahoo-injector.ts` to log extracted `EmailData`, including extraction debouncing

**Checkpoint**: User Story 1 (Standard Yahoo Mail) is functional and testable.

---

## Phase 4: User Story 2 - Raw Email Extraction from 'View Raw Message' (Priority: P1)

**Goal**: Inject an extraction button into the Yahoo "View Raw Message" page and extract the full raw payload.

**Independent Test**: Open "View Raw Message" in Yahoo Mail, click the floating shield icon, and verify the full raw text is logged.

### Implementation for User Story 2

- [x] T010 [P] [US1] [US2] Update `src/content/yahoo/yahoo-extractor.ts` to include logic for extracting raw text from the `pre` tag
- [x] T011 [US2] Update `src/content/yahoo/yahoo-injector.ts` to support floating overlay injection for URLs matching `*/messages/*/raw`, including extraction debouncing
- [x] T012 [US2] Update `src/content/yahoo/index.ts` to detect the raw view URL and switch to the raw injection/extraction mode

**Checkpoint**: User Story 2 (Raw Yahoo Mail) is functional and testable.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and ensuring no regressions.

- [x] T013 [P] Verify Gmail extraction still works correctly (zero regressions)
- [x] T014 [P] Verify the 5MB payload warning triggers correctly in Yahoo raw view
- [x] T015 Run validation steps defined in `specs/003-yahoo-mail-support/quickstart.md`
- [x] T016 [P] Cleanup any debug logs used during Yahoo development
- [x] T017 [P] Implement graceful failure logic in Yahoo extraction to log silent errors on DOM mismatch without breaking native UI

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Setup.
- **User Stories (Phase 3 & 4)**: Depend on Foundational completion. US1 and US2 can be worked on in parallel or sequence.
- **Polish (Phase 5)**: Depends on all user stories being complete.

### Parallel Opportunities

- T006 [US1] and T007 [US1] can be started together (Interface vs Implementation).
- T010 [US2] and T011 [US2] can be started together.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 & 2.
2. Complete Phase 3 (Standard View Support).
3. **STOP and VALIDATE**: Verify standard email scanning in Yahoo.

### Full Support

1. Complete Phase 4 (Raw View Support).
2. Final validation and regression testing in Phase 5.
