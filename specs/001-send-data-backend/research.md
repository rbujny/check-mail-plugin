# Research: Send Data to Backend

## 1. Retry Mechanism for Network Requests
**Decision**: Implement a linear retry mechanism with a maximum of 3 attempts and a 1-second delay between attempts using the `fetch` API.
**Rationale**: The requirement is basic robustness against temporary network failures. A linear 1-second delay is simple to implement and sufficient for a local endpoint (`localhost:8080`) or a standard backend API without overcomplicating with exponential backoff.
**Alternatives considered**: 
- *Exponential backoff*: Overkill for a local endpoint or a simple MVP, though better for production rate-limiting.
- *No retries (Fail fast)*: Rejected during the specification clarification phase to improve UX.

## 2. User Notification on Failure
**Decision**: Use `chrome.notifications.create` (if permissions allow) or pass a message back to the active tab's content script to inject a lightweight DOM toast notification. We will try passing a message to the content script first to avoid adding new manifest permissions (`notifications`), adhering to the principle of least privilege.
**Rationale**: Constitution Principle VI requires clear UX feedback on error states. Since the transmission happens in the background service worker, it must communicate back to the user context. Injecting a UI notification in the active tab (using existing content script message passing) avoids new permissions.
**Alternatives considered**: 
- `chrome.notifications`: Good, but requires adding `"notifications"` to `manifest.json`.
- Alert in popup: The user might have closed the popup while the request is processing, making the popup an unreliable place for asynchronous failure notifications.

## 3. Data Payload Format
**Decision**: Serialize the `EmailData` object to a standard JSON string payload and send it via `POST` with `Content-Type: application/json`.
**Rationale**: JSON is universally supported and explicitly suggested by the requirements. It maps perfectly to TypeScript objects currently extracted.
**Alternatives considered**:
- *FormData/URL-encoded*: Less structured, harder to handle nested headers (like arrays or objects).
