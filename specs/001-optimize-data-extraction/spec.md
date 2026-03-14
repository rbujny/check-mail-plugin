# Feature Specification: Optimize Data Extraction

**Feature Branch**: `001-optimize-data-extraction`  
**Created**: 2026-03-09  
**Status**: Draft  
**Input**: User description: "Role: You are a Technical Product Manager and Cybersecurity Architect working on a Manifest V3 browser extension built with Svelte and Vite. Header Optimization: Do not send raw cryptographic signatures (like arc-seal or dkim-signature). The system must parse the authentication-results header locally in the DOM and extract ONLY the string verdicts (e.g., SPF: pass, DKIM: fail, DMARC: none). Keep crucial targeting headers (To, From, Subject, Reply-To). Body Text Optimization: The system must not send the full raw body. It should extract all URLs into a deduplicated array, replace the URLs in the raw text with a [LINK] placeholder, normalize whitespaces, and truncate the remaining text to a maximum of 1000 characters. Data Flow: This processing must happen inside the Content Script before sending the data via fetch to the backend or passing it via Chrome Message Passing to the Service Worker/Sidepanel."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secure Header Processing (Priority: P1)

As a security-conscious user, I want the system to extract only necessary email headers (like To, From, Subject, Reply-To) and security verdicts (SPF, DKIM, DMARC) locally within my browser, discarding raw cryptographic signatures, so that the data sent to the external analysis service is minimized and my privacy is preserved.

**Why this priority**: It is critical to reduce the amount of data transmitted and stop raw cryptographic signatures from leaving the user's secure perimeter, maintaining a high security standard and improving performance.

**Independent Test**: Can be independently tested by inspecting the extracted data package from a sample email before it is transmitted. The package must contain only the specified targeting headers and parsed string verdicts without any raw cryptographic signatures.

**Acceptance Scenarios**:

1. **Given** an email with cryptographic signature headers, **When** the system processes the email locally, **Then** the extracted data must not contain these raw signatures.
2. **Given** an email with an authentication-results header, **When** the system processes the email locally, **Then** it must successfully parse and extract the human-readable string verdicts for SPF, DKIM, and DMARC.
3. **Given** an email with standard targeting headers, **When** the system processes the email locally, **Then** it must correctly retain the To, From, Subject, and Reply-To headers.

---

### User Story 2 - Minimalist Body Text Extraction (Priority: P1)

As a security-conscious user, I want the system to extract all URLs from the email body into a separate list, replace them with a generic placeholder in the text, normalize the whitespace, and truncate the remaining text to a strict length limit, so that only the essential content and extracted links are transmitted for analysis.

**Why this priority**: Sending complete raw email bodies is inefficient and potentially exposes unnecessary user data. Optimizing the body text directly impacts the system's performance and privacy footprint.

**Independent Test**: Can be tested independently by feeding a sample email body with multiple URLs, extra whitespaces, and over 1000 characters to the local processing logic. The output should be a deduplicated list of URLs and a clean, truncated text blob with placeholders.

**Acceptance Scenarios**:

1. **Given** an email body containing multiple URLs (including duplicates), **When** the system processes the text, **Then** it must extract a deduplicated array of all URLs.
2. **Given** an email body with URLs, **When** the system processes the text, **Then** all original URLs in the text must be replaced with the string `[LINK]`.
3. **Given** an email body with irregular whitespace and newlines, **When** the system processes the text, **Then** the resulting text must have normalized, single-space constraints.
4. **Given** an email body that exceeds 1000 characters after URL replacement and whitespace normalization, **When** the system processes the text, **Then** the text must be strictly truncated to a maximum of 1000 characters.

---

### Edge Cases

- What happens when the authentication-results header is malformed or missing expected protocols (e.g., only has SPF but no DKIM)?
- How does the system handle an email body that is entirely composed of URLs?
- What happens when a URL is malformed or spans across multiple lines?
- How does the system handle an email missing one of the crucial targeting headers (e.g., no Reply-To or To field)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST process all email data entirely locally within the user's browser context before it is transmitted to any external service or secondary application layers.
- **FR-002**: The system MUST NOT extract or transmit raw cryptographic signatures, specifically excluding but not limited to arc-seal and dkim-signature.
- **FR-003**: The system MUST retain only the To, From, Subject, Reply-To, and Received chain headers from the email envelope.
- **FR-004**: The system MUST parse the authentication-results header to output only string verdicts (e.g., "SPF: pass", "DKIM: fail", "DMARC: none").
- **FR-005**: The system MUST extract all URLs from the email body into a separate, deduplicated array.
- **FR-006**: The system MUST replace all occurrences of URLs within the locally parsed email body text with the placeholder `[LINK]`.
- **FR-007**: The system MUST normalize consecutive whitespaces and newlines in the email body text into single spaces.
- **FR-008**: The system MUST truncate the final processed email body text to a maximum length of 1000 characters.

### Dependencies and Assumptions

- **Assumption**: The system is capable of running all data extraction and parsing logic safely and efficiently within the initial browser page context.
- **Assumption**: URLs extracted from the body can be unambiguously identified by standard pattern matching.

### Key Entities 

- **ProcessedEmailData**: The data package generated by local processing, containing the retained headers, parsed security verdicts, deduplicated URL array, and the normalized, truncated body text.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Payload size of the extracted email data package is reduced by at least 50% on average compared to sending raw email data.
- **SC-002**: 100% of generated payloads strictly exclude raw cryptographic signatures.
- **SC-003**: 100% of extracted body text sent from the local system is strictly truncated to 1000 characters or less.
- **SC-004**: Data extraction logic executes in under 50 milliseconds per email to ensure no noticeable user interface lag.
