# CheckMailPlugin Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-28

## Active Technologies
- TypeScript (strict mode) + None (vanilla DOM manipulation within extension content script) (002-show-original-extract)
- TypeScript (strict mode) / Svelte 5 + `chrome` types for service worker and messaging, native `fetch` API (001-send-data-backend)
- None (beyond in-memory state tracking for retries) (001-send-data-backend)
- [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION] (001-optimize-data-extraction)
- [if applicable, e.g., PostgreSQL, CoreData, files or N/A] (001-optimize-data-extraction)

- TypeScript 5.9 (strict mode) + Svelte 5.45, Vite 7.3, `@crxjs/vite-plugin` 1.0, `@sveltejs/vite-plugin-svelte` 6.2 (001-gmail-email-extraction)

## Project Structure

```text
src/
tests/
```

## Commands

npm test; npm run lint

## Code Style

TypeScript 5.9 (strict mode): Follow standard conventions

## Recent Changes
- 001-optimize-data-extraction: Added [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]
- 001-send-data-backend: Added TypeScript (strict mode) / Svelte 5 + `chrome` types for service worker and messaging, native `fetch` API
- 002-show-original-extract: Added TypeScript (strict mode) + None (vanilla DOM manipulation within extension content script)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
