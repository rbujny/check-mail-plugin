# Implementation Plan: Send Data to Backend

**Branch**: `001-send-data-backend` | **Date**: 2026-03-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-send-data-backend/spec.md`

## Summary

The objective is to replace the current client-side debug logging of extracted email data with a functional network transmission to a backend endpoint (`http://localhost:8080/process.php`). This involves sending a JSON representation of email headers and body text using the `fetch` API, implementing a linear 3-attempt retry mechanism, and providing graceful UI notification (e.g., via a toast or popup message) upon ultimate failure.

## Technical Context



**Language/Version**: TypeScript (strict mode) / Svelte 5  
**Primary Dependencies**: `chrome` types for service worker and messaging, native `fetch` API  
**Storage**: None (beyond in-memory state tracking for retries)  
**Testing**: Vitest  
**Target Platform**: Google Chrome (desktop browser extension)
**Project Type**: Chrome Extension  
**Performance Goals**: Network request timeout of 30 seconds; retries must not block the host page thread  
**Constraints**: Extension bundle size < 1MB, Service Worker environment restricted constraints  
**Scale/Scope**: Interacting directly with the current open tab in Gmail

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Security-First (Principe I)**: Passes. No data is stored persistently; the HTTPS connection will be added later, though we accept HTTP for the `localhost` MVP endpoint today.
- **Chrome App Compliance (Principle II)**: Passes. Requesting no additional dangerous permissions beside standard background processing.
- **Separation of Concerns (Principle III)**: Passes. The communication layer (Service Worker context) will be updated to handle `fetch()`, rather than the extraction phase executing `console.log`.
- **Lightweight (Principle IV)**: Passes. Uses native `fetch()`, no bulky Axios package required. Bundle size stays unaffected.
- **Feedback (Principle VI)**: Passes. Research phase requires sending a clear notification signal on a timeout/failure state since passive "silent failures" are not permitted by the Constitution.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)


```text
# Chrome Extension
src/
├── background/
│   └── index.ts      # Update to handle `fetch` request to backend and retry logic
├── content/
│   └── index.ts      # Remove console logs, add listener to show toast error from background
├── shared/
│   └── types.ts      # Ensure `EmailData` types are accurately exported here
```

**Structure Decision**: The logic will reside entirely in the `src/background/index.ts` (for the actual transmission) and `src/content/index.ts` or possibly `src/popup` components to receive the error state messages and display the Toast UI on failure.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Plain HTTP (`http://localhost:8080`) violates Principle I HTTPS mandate | Localhost development only; production will use HTTPS. No sensitive data leaves the local machine during development. | Using HTTPS with a self-signed certificate for localhost adds unnecessary setup friction for dev environments without meaningful security benefit. |
