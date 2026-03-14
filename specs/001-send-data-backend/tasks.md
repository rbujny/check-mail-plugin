# Tasks: Send Data to Backend

**Input**: Design documents from `/specs/001-send-data-backend/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and base type updates

- [x] T001 Update `EmailDataPayload` interfaces to reflect the exact JSON payload structure (headers, bodyText) in `src/shared/types.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

*(No blocking foundational tasks needed for this iteration. Proceed directly to User Story 1.)*

---

## Phase 3: User Story 1 - Extracted Data Transmission (Priority: P1) 🎯 MVP

**Goal**: Automatically transmit extracted email data securely to the local backend while removing deprecated console logging, and providing graceful UI failure notifications.

**Independent Test**: Can be validated using network monitoring tools or a dummy backend to ensure the payload arrives successfully, and verified via Chrome DevTools that no console spam occurs.

### Implementation for User Story 1

- [x] T002 [P] [US1] Remove deprecated `console.log` statements for extracted `EmailDataPayload` data in `src/content/index.ts`
- [x] T003 [P] [US1] Implement the base `fetch` POST request sending `EmailDataPayload` as JSON to `http://localhost:8080/process.php` inside the message handler in `src/background/index.ts`
- [x] T004 [US1] Wire up `AbortController` with a 30-second timeout signal on the `fetch` call in `src/background/index.ts`; timeout triggers the same Toast notification path as network failures
- [x] T005 [US1] Wrap the `fetch` request in `src/background/index.ts` with a linear 3-attempt retry mechanism (with a 1-second delay between attempts)
- [x] T006 [P] [US1] Add a visible transmission indicator (e.g., icon badge change via `chrome.action.setBadgeText`) while the `fetch` request is in progress in `src/background/index.ts`
- [x] T007 [P] [US1] Add a message listener to inject and display a graceful UI Toast notification on error in `src/content/index.ts` — Toast MUST use red error styling, meet WCAG 2.1 AA contrast, and auto-dismiss after 5 seconds
- [x] T008 [US1] Send a failure message back to the active tab's content script upon exhaustion of retries in `src/background/index.ts`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T009 Run manual validation testing following scenarios in `quickstart.md`
- [x] T010 Cleanup extension code and verify Svelte components build without type errors (`npm run check`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Must be completed first to ensure types are correct.
- **User Stories (Phase 3+)**: US1 depends on Setup completion.
- **Polish (Final Phase)**: Depends on US1 completion.

### User Story Dependencies

- **User Story 1 (P1)**: The MVP feature. It handles the entire end-to-end logic for this sprint.

### Parallel Opportunities

- Content script changes (T002, T007) can be developed independently from Background script changes (T003, T004, T005, T006).
- T006 (visible indicator) can be developed in parallel with T005 (retry logic) since they touch different concerns in the same file.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (Update `types.ts`)
2. Complete Phase 3: User Story 1
3. **STOP and VALIDATE**: Test User Story 1 independently against `quickstart.md`
4. Polish and Final code checks
