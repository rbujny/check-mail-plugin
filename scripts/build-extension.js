/**
 * build-extension.js
 *
 * Builds all content scripts and the background service worker
 * using esbuild's programmatic API. Replaces the long inline
 * shell command that was previously in package.json.
 *
 * Each entry maps a source file to an output filename in dist/.
 */

import * as esbuild from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

/** Entry points: [source path relative to root] → [output filename in dist/] */
const entries = [
    // Gmail
    { input: 'src/content/gmail/index.ts', output: 'gmail-content.js' },
    { input: 'src/content/gmail/show-original/index.ts', output: 'gmail-show-original-content.js' },
    // Yahoo
    { input: 'src/content/yahoo/index.ts', output: 'yahoo-content.js' },
    // Outlook
    { input: 'src/content/outlook/index.ts', output: 'outlook-content.js' },
    // ProtonMail
    { input: 'src/content/proton/index.ts', output: 'proton-content.js' },
    // WP
    { input: 'src/content/wp/index.ts', output: 'wp-content.js' },
    // Onet
    { input: 'src/content/onet/index.ts', output: 'onet-content.js' },
    // Interia
    { input: 'src/content/interia/index.ts', output: 'interia-content.js' },
    // Background service worker
    { input: 'src/background/index.ts', output: 'service-worker.js' },
];

async function build() {
    const startTime = performance.now();

    const promises = entries.map(({ input, output }) =>
        esbuild.build({
            entryPoints: [resolve(root, input)],
            bundle: true,
            outfile: resolve(root, 'dist', output),
            format: 'iife',
            logLevel: 'warning',
        })
    );

    await Promise.all(promises);

    const elapsed = (performance.now() - startTime).toFixed(0);
    console.log(`[build-extension] ✅ Built ${entries.length} bundles in ${elapsed}ms`);
}

build().catch((err) => {
    console.error('[build-extension] ❌ Build failed:', err);
    process.exit(1);
});
