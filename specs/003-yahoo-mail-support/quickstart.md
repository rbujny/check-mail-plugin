# Quickstart: Yahoo Mail Support

## Overview
This feature adds support for extracting email content from Yahoo Mail. It works identically to the Gmail integration: a shield icon will appear in the toolbar while reading an email, and in the "View Raw Message" window.

## Development Setup
1. **Host Permissions**: Ensure `manifest.json` includes `https://mail.yahoo.com/*`.
2. **Build**: Run `npm run build` to compile the new content scripts.
3. **Load**: Sideload the `dist` directory in Chrome.

## Testing
1. Login to a Yahoo Mail account.
2. Open any email.
3. Verify the "Scan with CheckMail" button appears in the top toolbar (near Reply/Forward).
4. Click the button and check the DevTools Console for the `[CheckMailPlugin] Email Extraction` log.
5. Click "More" (...) -> "View Raw Message".
6. Verify the floating extraction button appears in the raw view.
7. Click it and verify the full raw message is logged.

## Troubleshooting
- If the icon doesn't appear, check if Yahoo has changed its `data-test-id="toolbar"` attribute.
- Ensure the content script is correctly matched for the Yahoo Mail URL pattern in `manifest.json`.
