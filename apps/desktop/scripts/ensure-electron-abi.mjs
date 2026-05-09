/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Use of this software for any commercial purpose is prohibited.
 * The software is provided "AS IS", WITHOUT WARRANTY OR CONDITION OF ANY KIND,
 * either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/**
 * Predev hook for `apps/desktop pnpm dev`: make sure better-sqlite3 is the
 * Electron ABI build. Symmetric counterpart to
 * apps/web/server/scripts/ensure-node-abi.mjs.
 *
 * Why detection is "Electron-or-bust":
 * - Postinstall already runs the Electron swap during `pnpm install`, so the
 *   common case is no-op.
 * - When the developer last ran `apps/web/server pnpm dev`, that hook flipped
 *   the binding to Node ABI; without this script Electron would crash on
 *   require('better-sqlite3') in dev.
 *
 * We piggy-back on the same `prebuild-install --runtime electron --target X`
 * invocation the existing postinstall.mjs uses, so caching behaviour is
 * identical: the swap is sub-second once both ABIs have been fetched once.
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(here, '../../..');
const requireFromRoot = createRequire(resolve(workspaceRoot, 'package.json'));

const electronPkgPath = resolve(workspaceRoot, 'node_modules/electron/package.json');

let electronVersion;
try {
  electronVersion = JSON.parse(readFileSync(electronPkgPath, 'utf-8')).version;
} catch {
  console.warn('[ensure-electron-abi] electron package not found, skipping');
  process.exit(0);
}

const moduleDir = dirname(requireFromRoot.resolve('better-sqlite3/package.json'));

// Read NODE_MODULE_VERSION out of the .node binary header. The first 8 bytes
// are the Mach-O / ELF magic; we don't need to parse them — we just compare
// the binary to what the system Node ABI expects. If they agree, the file
// is the Node prebuild and we have to swap. If they don't, the file is
// either Electron-ABI (good for desktop dev) or already swapped to something
// compatible with running under Electron.
//
// The cheapest, most reliable detection is the same as ensure-node-abi.mjs:
// try to instantiate a Database from the system Node we're invoked from. If
// it succeeds, the binding matches our (Node) ABI and we MUST swap to
// Electron. If it fails with a NODE_MODULE_VERSION error, the binding is
// already a non-Node build — almost certainly Electron — and we leave it.
function bindingLoadsUnderSystemNode() {
  try {
    const Database = requireFromRoot('better-sqlite3');
    const db = new Database(':memory:');
    db.close();
    return true;
  } catch {
    return false;
  }
}

if (!bindingLoadsUnderSystemNode()) {
  // Already a non-Node ABI build — assume Electron and skip the swap.
  // Worst case the developer hits a different ABI mismatch when Electron
  // boots and reruns this script via a fresh `pnpm dev`, which will then
  // prebuild-install for the right Electron version.
  process.exit(0);
}

console.log(`[ensure-electron-abi] Switching better-sqlite3 prebuild back to Electron ${electronVersion} (${process.arch})`);

try {
  execSync(
    `npx prebuild-install --runtime electron --target ${electronVersion} --arch ${process.arch} --tag-prefix v`,
    { cwd: moduleDir, stdio: 'inherit' }
  );
} catch (err) {
  console.error('[ensure-electron-abi] prebuild-install failed:', err.message ?? err);
  process.exit(1);
}

console.log('[ensure-electron-abi] better-sqlite3 is now Electron-ABI compatible.');
