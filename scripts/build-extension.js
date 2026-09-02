
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

const apiBaseUrl = process.env.CHECKMAIL_API_BASE_URL || 'http://localhost:8080';
const apiKey = process.env.CHECKMAIL_API_KEY || '';

const entries = [
    { input: 'src/content/gmail/index.ts', output: 'gmail-content.js' },
    { input: 'src/content/gmail/show-original/index.ts', output: 'gmail-show-original-content.js' },
    { input: 'src/content/yahoo/index.ts', output: 'yahoo-content.js' },
    { input: 'src/content/outlook/index.ts', output: 'outlook-content.js' },
    { input: 'src/content/wp/index.ts', output: 'wp-content.js' },
    { input: 'src/content/onet/index.ts', output: 'onet-content.js' },
    { input: 'src/content/interia/index.ts', output: 'interia-content.js' },
    { input: 'src/background/index.ts', output: 'service-worker.js' },
];

async function build() {
    const startTime = performance.now();

    const define = {
        'process.env.CHECKMAIL_API_BASE_URL': JSON.stringify(apiBaseUrl),
        'process.env.CHECKMAIL_API_KEY': JSON.stringify(apiKey),
    };

    const promises = entries.map(({ input, output }) =>
        esbuild.build({
            entryPoints: [resolve(root, input)],
            bundle: true,
            outfile: resolve(root, 'dist', output),
            format: 'iife',
            logLevel: 'warning',
            define,
        })
    );

    await Promise.all(promises);

    patchManifestHostPermissions(resolve(root, 'dist', 'manifest.json'));

    const elapsed = (performance.now() - startTime).toFixed(0);
    console.log(`[build-extension] ✅ Built ${entries.length} bundles in ${elapsed}ms (API_BASE_URL: ${apiBaseUrl})`);
}

function patchManifestHostPermissions(manifestPath) {
    if (!existsSync(manifestPath)) return;
    try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        const hostPattern = apiBaseUrl.endsWith('/') ? `${apiBaseUrl}*` : `${apiBaseUrl}/*`;
        if (Array.isArray(manifest.host_permissions) && !manifest.host_permissions.includes(hostPattern)) {
            manifest.host_permissions.push(hostPattern);
            writeFileSync(manifestPath, JSON.stringify(manifest, null, 4), 'utf8');
            console.log(`[build-extension] 🔑 Added "${hostPattern}" to manifest host_permissions`);
        }
    } catch (err) {
        console.warn('[build-extension] Warning: Could not patch manifest host_permissions:', err);
    }
}

build().catch((err) => {
    console.error('[build-extension] ❌ Build failed:', err);
    process.exit(1);
});
