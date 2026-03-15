# Research: Yahoo Mail Support

## Decision: Targeted DOM Selectors & URL Injection

### Rationale
Yahoo Mail uses a dynamic DOM similar to Gmail, but with consistent `data-test-id` attributes that provide a stable hook for content scripts. The "View Raw Message" functionality opens a separate view that we can target via URL matching and simple `pre` tag extraction.

### Findings

#### 1. Standard Message View
- **Host**: `mail.yahoo.com`
- **Toolbar Selector**: `[data-test-id="toolbar"]` or `[data-test-id="message-view-toolbar"]`
- **Subject Selector**: `[data-test-id="message-view-subject"]`
- **Sender Selector**: `[data-test-id="message-view-sender"]`
- **Body Selector**: `[data-test-id="message-view-body"]`
- **Trigger**: MutationObserver on `document.body` (same as Gmail).

#### 2. Raw Message View
- **URL Pattern**: `https://mail.yahoo.com/d/folders/*/messages/*/raw`
- **Content Selector**: `pre` (the entire body is usually a single pre element).
- **Injection Strategy**: The raw view is often just the raw text inside a `pre`. We will inject a floating overlay button at the top-right of the viewport to trigger extraction, as there is no consistent native toolbar to append to.

### Alternatives Considered

#### Using IMAP/API
- **Rejected**: Requires OAuth/API keys and backend changes. The current plugin architecture is strictly "scrape/extract from UI" to avoid complex auth flows and maintain a lightweight profile.

#### Generic DOM Parsing (Regex)
- **Rejected**: Too fragile. Yahoo's `data-test-id` attributes are purposely provided for testing/automation and are significantly more stable than CSS classes.

### Risks & Mitigations
- **Risk**: Yahoo changes `data-test-id` names.
- **Mitigation**: Implement a multi-selector fallback strategy and log a specific error if injection fails, allowing rapid patching without breaking the core extension.
