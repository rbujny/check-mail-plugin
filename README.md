# CheckMailPlugin 🛡️

A privacy-focused browser extension that extracts and optimizes email data for security analysis. Built with Svelte 5, TypeScript, Vite, and esbuild.

## Features

- **Multi-Client Support**:
  - **Gmail**: Deep integration for standard and threaded message views.
  - **Yahoo Mail**: Support for both standard message views and the "View Raw Message" API view.
- **Privacy First**: All processing happens locally. Emails are optimized (stripped of signatures and tracking headers, truncated for LLM analysis) before leaving the browser.
- **Security Analysis Ready**: Extracts SPF/DKIM/DMARC verdicts and the full `Received` chain from raw views.
- **Payload Safety**: Handles large payloads (>5MB) with warnings and debounces extractions to prevent browser lag.

## Technology Stack

- **Framework**: Svelte 5 (Runes)
- **Bundler**: Vite + esbuild (for content script modularity)
- **State Management**: Svelte Runes
- **Testing**: Vitest + JSDOM
- **Build**: CRXJS for Manifest V3 integration

## Installation & Setup

### For Developers

1. **Clone the repository**:
   ```bash
   git clone https://github.com/rbujny/check-mail-plugin.git
   cd check-mail-plugin
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the extension**:
   ```bash
   npm run build
   ```
   This will generate a `dist/` directory containing the bundled extension.

### Load in Chrome/Edge/Opera

1. Navigate to your browser's extensions page (e.g., `chrome://extensions/`).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `dist/` folder from the project root.

## Usage

### Gmail
- Open any email.
- Click the **Shield Icon** 🛡️ in the email toolbar (next to Print).
- The optimized data will be logged to the background service worker or visible in the console.

### Yahoo Mail
- **Standard View**: Find the shield icon in the message action toolbar.
- **Raw View**: When viewing "Raw Message", a floating **"Scan with CheckMail"** button will appear in the top-right corner.

## Development

- **Dev mode**: `npm run dev` (starts the Vite dev server)
- **Type Check**: `npm run check` (runs svelte-check and tsc)
- **Test**: `npm run test` (Vitest)
- **Lint**: `npm run lint`

## Project Mission

The goal of this plugin is to provide a standardized, clean, and optimized JSON payload from any mail client, specifically focused on details required for an LLM to perform effective phishing and fraud analysis.

---
© 2026 Radosław Bujny. All Rights Reserved.
