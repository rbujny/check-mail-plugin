
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

const leakedManifest = resolve(distDir, 'manifest.firefox.json');
if (existsSync(leakedManifest)) {
    rmSync(leakedManifest);
}

if (existsSync(firefoxDir)) {
    rmSync(firefoxDir, { recursive: true });
}
mkdirSync(firefoxDir, { recursive: true });
cpSync(distDir, firefoxDir, { recursive: true });

const targetManifest = resolve(firefoxDir, 'manifest.json');
copyFileSync(firefoxManifest, targetManifest);

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
