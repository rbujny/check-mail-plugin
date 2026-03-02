# Feature Specification: Show Original Email Extraction

**Feature Branch**: `002-show-original-extract`  
**Created**: 2026-03-02
**Status**: Draft  
**Input**: User description: "Currentlly we have our shield in this place to get simplified data (without headers etc). Now we want put our 'shield' in somewhere else in other section (when you click show original on gmail you got original) and from this place also we want process all data from mail (including headers and others additional things). Consider best place for our plugin in show original as an UI/UX desing expert. Let plugin log data the same as in simplified way."

## Clarifications

### Session 2026-03-02
- Q: Multiple Clicks Behavior → A: Ignore subsequent clicks while processing (applies to both the new 'Show Original' extraction and the existing simplified extraction flows).
- Q: Large Email Handling → A: Extract full payload but log a size warning if over a threshold (e.g., 5MB).
- Q: Layout Updates → A: Fail gracefully and log a silent error to the console.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Extract Raw Email Data from 'Show Original' View (Priority: P1)

As a security-conscious user inspecting an email, I want to see the plugin's shield icon in the 'Show Original' view and click it to extract the full raw email data (including all headers), so that I can process the complete information.

**Why this priority**: This is the core functionality requested by the user, enabling the plugin to access and process the unstripped, full email data which is critical for deep analysis.

**Independent Test**: Can be fully tested by opening any email's 'Show Original' view, locating the injected shield icon, clicking it, and verifying that the full email payload (headers and body) is logged.

**Acceptance Scenarios**:

1. **Given** the user has opened an email in Gmail's 'Show Original' view, **When** the page loads, **Then** the plugin's shield icon should be visible in a prominent, natural location (e.g., alongside the existing action buttons).
2. **Given** the shield icon is visible in the 'Show Original' view, **When** the user clicks the shield, **Then** the plugin extracts all raw email data, including headers and body content.
3. **Given** the plugin has extracted the raw data, **When** extraction is complete, **Then** the plugin must process and log the data in the same format as the existing simplified extraction feature.

---

### Edge Cases

- How does the system handle layout updates? (Resolved: Fail gracefully by halting extraction/injection, logging a structured silent target-not-found error without breaking native UI).
- How does the system handle extremely large raw email data? (Resolved: System extracts the full payload but issues a console warning if the size exceeds a defined threshold e.g., >5MB).
- How does the system handle concurrent processing attempts? (Resolved: Ignore subsequent clicks until current extraction completes for both simplified and raw flows).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST detect when the user opens a Gmail 'Show Original' view.
- **FR-002**: The system MUST place the plugin's "shield" icon into the 'Show Original' UI alongside existing action buttons (like "Copy to clipboard" or "Download original") for an optimal user experience.
- **FR-003**: The system MUST extract the complete raw text of the email (including all headers and body parts) from the 'Show Original' view when the shield is clicked.
- **FR-004**: The system MUST process the extracted raw email data and log it using the exact same logging mechanism as the simplified view extraction.
- **FR-005**: The system MUST ignore subsequent extraction clicks while an extraction is already in progress to prevent duplicate processing. This identical debouncing/locking mechanism MUST be applied to both the new 'Show Original' view and the existing simplified view.
- **FR-006**: The system MUST extract the full raw payload regardless of size, but MUST generate a console warning before logging the data if the extracted payload exceeds a configurable threshold (default: 5MB).
- **FR-007**: The system MUST fail gracefully (halting execution and logging a silent, structured error to the console) if Gmail's layout changes cause the target injection point or raw text container to be unfindable. This MUST prevent any disruption or freezing of the native Gmail UI.

### Non-Functional Requirements & Assumptions

- **UX Design Assumption**: Placing the shield next to primary actions in the header of the 'Show Original' view represents the best, most intuitive user experience.

### Key Entities *(include if feature involves data)*

- **Raw Email Data**: Represents the complete, unparsed message text retrieved from the 'Show Original' view.
- **Processed Email Data**: The structured representation of the raw email, including parsed headers and body, ready for logging.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The shield icon successfully injects and renders alongside action buttons in the 'Show Original' view 100% of the time, regardless of the browser window size.
- **SC-002**: Complete extraction of all headers and body data from the raw view is successful on click without user-facing errors.
- **SC-003**: The logged output format for the 'Show Original' extraction natively matches the logging structure/format of the simplified extraction.
