# Quickstart

This section explains how to implement the "Show Original" Email Extraction.

**1. Create the new Injector (`src/content/show-original-injector.ts`)**
- Find the container with the action buttons on the `view=om` Gmail URL.
- Create an identical button to the original shield.
- Attach a click listener that acts on the raw layout. Ensure the button uses `dataset.extracting` for the lock/debounce logic.

**2. Create the new Extractor (`src/content/show-original-extractor.ts`)**
- Grabs the raw text payload from the page DOM (often inside `<pre>` or `.raw_message_text`).
- Parse or construct standard `ProcessedEmailData`.
- Includes size validation before returning the data.

**3. Update Existing Shield (`src/content/icon-injector.ts`)**
- Verify the debounce logic exists, if not, augment the click listener with `dataset.extracting` locking logic as done in the new scripts.

**4. Update Manifest**
- Add a new content script entry for `https://mail.google.com/mail/*?*view=om*` pointing to the new injector module.
