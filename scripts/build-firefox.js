/**
 * build-firefox.js
 *
 * Post-build script that copies the Chrome dist/ output into dist-firefox/
 * and replaces the manifest with the Firefox-specific version.
 */

import { cpSync, copyFileSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

const distDir = resolve(root, 'dist');
const firefoxDir = resolve(root, 'dist-firefox');
const firefoxManifest = resolve(root, 'public', 'manifest.firefox.json');
const apiBaseUrl = process.env.CHECKMAIL_API_BASE_URL || 'http://localhost:8080';

// 0. Clean up manifest.firefox.json leaked into dist/ by Vite (it copies all of public/)
const leakedManifest = resolve(distDir, 'manifest.firefox.json');
if (existsSync(leakedManifest)) {
    rmSync(leakedManifest);
}

// 1. Clean and copy entire dist/ → dist-firefox/
if (existsSync(firefoxDir)) {
    rmSync(firefoxDir, { recursive: true });
}
mkdirSync(firefoxDir, { recursive: true });
cpSync(distDir, firefoxDir, { recursive: true });

// 2. Overwrite manifest.json with Firefox-specific version
const targetManifest = resolve(firefoxDir, 'manifest.json');
copyFileSync(firefoxManifest, targetManifest);

// 3. Patch Firefox manifest to include apiBaseUrl in host_permissions
try {
    const manifest = JSON.parse(readFileSync(targetManifest, 'utf8'));
    const hostPattern = apiBaseUrl.endsWith('/') ? `${apiBaseUrl}*` : `${apiBaseUrl}/*`;
    if (Array.isArray(manifest.host_permissions) && !manifest.host_permissions.includes(hostPattern)) {
        manifest.host_permissions.push(hostPattern);
        writeFileSync(targetManifest, JSON.stringify(manifest, null, 4), 'utf8');
    }
} catch (err) {
    console.warn('[build-firefox] Warning: Could not patch Firefox manifest host_permissions:', err);
}

console.log('[build-firefox] ✅ dist-firefox/ created with Firefox manifest');
