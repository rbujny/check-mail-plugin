# Quickstart: Gmail Email Extraction

**Feature**: `001-gmail-email-extraction`
**Date**: 2026-02-28

## Prerequisites

- **Node.js** 18+ and npm
- **Google Chrome** (latest stable)
- A Gmail account with at least one email in the inbox

## Setup

```bash
# 1. Clone the repository and install dependencies
git clone <repo-url>
cd CheckMailPlugin
npm install

# 2. Build the extension for development
npm run dev
```

The dev server will produce a loadable extension in the `dist/`
directory (or as configured by `@crxjs/vite-plugin`).

## Sideload in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `dist/` directory from the project root
5. The CheckMailPlugin extension should now appear in the list

## Verify It Works

1. Navigate to [Gmail](https://mail.google.com/)
2. Open any email
3. Look for the CheckMailPlugin icon (shield icon) in the email
   toolbar, near **"Print all"** and **"Open in new window"** buttons
4. If it's a thread, each expanded message should have its own icon
5. Click the icon
6. Open **DevTools** → **Console** (`F12` or `Ctrl+Shift+I`)
7. Look for a console group titled
   `[CheckMailPlugin] Email Extraction` with the extracted data

## Expected Console Output

```text
▼ [CheckMailPlugin] Email Extraction
    {
      success: true,
      warnings: [],
      source: "Meeting tomorrow",
      data: {
        from: "Alice <alice@example.com>",
        to: ["bob@example.com"],
        cc: [],
        subject: "Meeting tomorrow",
        date: "Feb 28, 2026, 4:00 PM",
        bodyText: "Hi Bob, just confirming our meeting...",
        extractionTimestamp: "2026-02-28T16:00:00.000Z"
      }
    }
```

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Icon doesn't appear | Content script not injected | Check `chrome://extensions/` for errors; reload extension |
| Icon appears but click does nothing | Event listener not attached | Check DevTools console for errors |
| Partial extraction (warnings) | Gmail DOM changed | Update selectors in extraction module |
| Extension won't load | Build error | Run `npm run check` and fix TypeScript errors |

## Development Workflow

- Run `npm run dev` for hot-reloading during development
- After code changes, the extension auto-reloads (CRXJS HMR)
- For manual reload: go to `chrome://extensions/` and click the
  refresh icon on the CheckMailPlugin card
- Run `npm run check` to verify TypeScript correctness
- Run `npm run build` for production build
