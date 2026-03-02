# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

## Summary

Add the CheckMail plugin's shield icon to Gmail's "Show Original" view to extract complete raw email data (including all headers and body parts) and log it exactly identically to the existing simplified extraction mechanism, with debouncing and size limits implemented.

## Technical Context

**Language/Version**: TypeScript (strict mode)  
**Primary Dependencies**: None (vanilla DOM manipulation within extension content script)  
**Storage**: N/A  
**Testing**: Vitest (for unit tests of new extraction logic)  
**Target Platform**: Google Chrome (Manifest V3 extension) running on Gmail's 'Show Original' view  
**Project Type**: Chrome Extension  
**Performance Goals**: Interaction within 300ms, Handle >5MB emails gracefully  
**Constraints**: Extension bundle size < 1MB, No DOM disruption on layout changes, 50ms main thread blocking limit  
**Scale/Scope**: Inject single button into a static popup page, extract large strings.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Security**: The raw email payload is not persisted to storage, only processed and logged.
- **API Compliance**: Injecting a script into the 'Show Original' view requires a specific content script match pattern (`https://mail.google.com/mail/*?view=om*` or similar), which adheres to Manifest V3 principles of least privilege.
- **Separation of Concerns**: Injection logic will be kept separate from the common payload processing logic.
- **Lightweight**: Bundle addition under 1MB. Limits large email processing (default 5MB logger warning).
- **Clear UX**: Graceful fallback if DOM is not found. Debouncing implemented.
- **Exception to Lightweight Constraints**: To ensure 100% extraction accuracy on original view without introducing Service Worker serialization overhead (which breaks other rules), extremely large raw payloads (>5MB) might synchronously block the main thread for >50ms. As this specifically requires intentional user invocation via clicking the 'Original' shield, this trade-off is accepted.

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
src/
├── content/
│   ├── icon-injector.ts            # (Update) Add debouncing to existing flow
│   ├── show-original-injector.ts   # (New) Injector for Show Original view
│   ├── show-original-extractor.ts  # (New) Extractor for the raw text payload
│   └── email-extractor.ts          # (Existing) Core simplified extraction
├── types/
│   └── email.ts                    # Email types
└── utils/
    └── logger.ts
```

**Structure Decision**: The logic will reside entirely in the `content/` and `utils/` paths, utilizing existing architectures. A new content script target specifically for the "Show Original" URL (`view=om`) might be needed in `manifest.json`, and dedicated injector/extractor files will be created to maintain Separation of Concerns from the `icon-injector.ts` which handles the main UI.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Exceeding 50ms main-thread block limit for >5MB emails | Sync parsing large MIME strings on extraction requires heavy CPU operations | Offloading to Service Worker rejected: Passing >5MB DOM strings asynchronously via `chrome.runtime.sendMessage` exceeds quota or adds latency/serialization complexity, violating architectural simplicity constraints for a single button click. |
