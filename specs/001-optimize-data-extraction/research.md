# Research: Optimize Data Extraction

## Overview
This feature's requirements were crystal clear from the specification, leaving no major technical unknowns. The research phase validates the chosen approaches against the project's strict architectural constraints.

## Decisions

### Decision 1: Regular Expressions for URL Extraction and Whitespace Normalization
- **Decision**: We will use standard JavaScript regular expressions in the content script for finding URLs, replacing them with `[LINK]`, and normalizing whitespaces.
- **Rationale**: Built-in regex parsing in V8 is highly optimized and easily meets the `<50ms` execution constraint. It requires zero external dependencies, adhering to the "Lightweight & Performant" (Bundle < 1MB) constitution principle.
- **Alternatives considered**: Including a heavy NLP or parsing library. Rejected due to bundle size constraints.

### Decision 2: DOM-based Header Parsing
- **Decision**: We will parse `authentication-results` and identify verdict strings (SPF, DKIM, DMARC) using direct string manipulation and regex splits on the extracted raw header strings.
- **Rationale**: Minimal memory allocation; raw headers are parsed once and the large cryptographic strings (like `arc-seal`) are discarded immediately before the data is serialized to be sent to the Service Worker.
- **Alternatives considered**: Constructing a full AST for the email headers. Rejected as overkill and a risk to the 50ms processing budget.

### Decision 3: Content Script Only
- **Decision**: The entire processing logic resides in the Extraction layer (content script). The Svelte Presentation layer will remain unaware of this text preprocessing.
- **Rationale**: Directly supports the "Separation of Concerns" principle. The Communication layer receives the already-minimized `ProcessedEmailData` payload, saving serialization cost.

### Decision 4: Canonical URL Regex Pattern
- **Decision**: Use the pattern `https?:\/\/[^\s<>"')\]]+` for URL extraction from email body text.
- **Rationale**: This pattern matches HTTP and HTTPS URLs while stopping at whitespace, angle brackets, quotes, closing parentheses, and closing square brackets — all of which commonly terminate URLs in email body text. It handles the vast majority of real-world email URLs without pulling in trailing punctuation or HTML artifacts.
- **Alternatives considered**: Full RFC 3986 URI parser. Rejected as overly complex for the use case and a risk to the 50ms processing budget. The chosen pattern covers >99% of URLs encountered in typical email bodies.
