# Phase 0: Outline & Research

## Injecting on "Show Original" View
- **Decision**: Create a dedicated content script (`show-original-injector.ts`) that runs specifically on the "Show Original" URL.
- **Rationale**: The 'Show Original' view is a completely separate page with its own DOM structure (`view=om` parameter). Mixing its logic with `icon-injector.ts` violates Separation of Concerns.
- **Alternatives considered**: Checking `window.location.search` in the existing `icon-injector.ts` and branching logic. Rejected because it complicates the main injector and requires injecting the same large script into two distinct contexts.

## Extracting the Raw Email Data
- **Decision**: Attempt to locate the exact DOM container containing the raw text (e.g., class `.raw_message_text` or the primary `pre` block). Fall back to reading the `innerText` or `textContent` of the main container if the class changes.
- **Rationale**: Gmail's "Show Original" view generally outputs the raw MIME payload in a standard structure. If Gmail updates the specific classes, falling back to a structured element prevents a failing extraction.
- **Alternatives considered**: Fetching the raw email via the Gmail API using the message ID. Rejected because it requires additional user permissions and OAuth overhead, violating the "Lightweight" and "API Compliance" principles.

## Processing the Raw DOM Payload
- **Decision**: Develop a lightweight, rudimentary MIME parser that maps raw email payload blocks into the newly created `ExtendedEmailData` structure, conforming to the Logger limits.
- **Rationale**: Extracting just the raw wall of text lacks utility and breaks parity with the structured log. By parsing out headers and mapping them to `ExtendedEmailData`, parity is achieved without external heavy dependencies. 

## Implementing the Debouncing/Lock Mechanism
- **Decision**: Add a `data-extracting="true"` attribute to the button element as a state lock for the duration of processing. If a click occurs while the attribute exists, it will abort early.
- **Rationale**: Modifying the DOM state allows immediate visual feedback (e.g., a loading state) while preventing duplicated logs. It perfectly aligns with identical behavior needed in both the existing flow and the new flow.
- **Alternatives considered**: Global module-level boolean locks. Rejected as DOM state natively ties the lock to the triggering UI element.
