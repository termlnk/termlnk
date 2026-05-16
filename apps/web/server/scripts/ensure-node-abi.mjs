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
 * Predev hook: ensure better-sqlite3's native binding matches the current
 * Node.js ABI before vite/module-runner imports the workspace.
 *
 * apps/desktop/scripts/postinstall.mjs swaps better-sqlite3 to the Electron
 * ABI on every `pnpm install` so the desktop process can run unchanged.
 * That same binding cannot be loaded by the system Node we use to run
 * apps/web/server, so this script flips it back to the Node ABI when needed.
 *
 * Detection strategy:
 * - cheap path: try `require('better-sqlite3')`. If it loads, the ABI already
 *   matches process.versions.modules and we are done in <50ms.
 * - rebuild path: catch the dlopen `NODE_MODULE_VERSION` error and shell out
 *   to `prebuild-install --runtime=node`. prebuild-install caches downloads
 *   so the swap is sub-second on subsequent runs.
 *
 * Symmetric counterpart: apps/desktop/scripts/ensure-electron-abi.mjs flips
 * it the other direction before `apps/desktop pnpm dev`.
 */

import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(here, '../../../..');
const requireFromRoot = createRequire(resolve(workspaceRoot, 'package.json'));

function probeBinding() {
  // better-sqlite3 lazy-loads its .node binary on the first `new Database(...)`,
  // not at require() time, so we have to actually instantiate one. Use an
  // in-memory database so probing leaves no files behind.
  try {
    const Database = requireFromRoot('better-sqlite3');
    const db = new Database(':memory:');
    db.close();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err };
  }
}

function isAbiMismatch(err) {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('NODE_MODULE_VERSION') || err?.code === 'ERR_DLOPEN_FAILED';
}

const probe = probeBinding();
if (probe.ok) {
  // Already on Node ABI — nothing to do.
  process.exit(0);
}

if (!isAbiMismatch(probe.error)) {
  // A genuine load error (missing binding, broken install, etc.) — surface it.
  console.error('[ensure-node-abi] better-sqlite3 failed to load and the error is not an ABI mismatch:');
  console.error(probe.error);
  process.exit(1);
}

const moduleDir = dirname(requireFromRoot.resolve('better-sqlite3/package.json'));
const nodeMajor = process.versions.node;

console.log(`[ensure-node-abi] Switching better-sqlite3 prebuild to Node ${nodeMajor} (${process.arch})`);

try {
  execSync(
    `npx prebuild-install --runtime node --target ${nodeMajor} --arch ${process.arch} --tag-prefix v`,
    { cwd: moduleDir, stdio: 'inherit' }
  );
} catch (err) {
  console.error('[ensure-node-abi] prebuild-install failed:', err.message ?? err);
  console.error('[ensure-node-abi] Hint: run `pnpm rebuild better-sqlite3` if your Node version is unusual and lacks a published prebuild.');
  process.exit(1);
}

// Verify the swap worked.
const recheck = probeBinding();
if (!recheck.ok) {
  console.error('[ensure-node-abi] Swap completed but better-sqlite3 still fails to load:');
  console.error(recheck.error);
  process.exit(1);
}

console.log('[ensure-node-abi] better-sqlite3 is now Node-ABI compatible.');
