/**
 * Custom install script for @termlnk/macos-utils.
 *
 * When a package contains binding.gyp and has no install/preinstall script,
 * pnpm/npm run `node-gyp rebuild` by default. On Windows and Linux that
 * fails because window-utils.mm is Objective-C++ and depends on Cocoa.
 *
 * We declare this script explicitly so the default behavior is overridden:
 * on darwin we build the N-API addon; on any other platform we no-op,
 * and index.cjs already exposes stubs at runtime.
 *
 * The `"os": ["darwin"]` field in package.json is ignored for workspace
 * link: packages, so guarding at script level is required.
 */

'use strict';

if (process.platform !== 'darwin') {
  console.log(`[@termlnk/macos-utils] Skipping native addon build on ${process.platform}`);
  process.exit(0);
}

const { spawnSync } = require('node:child_process');

const result = spawnSync('node-gyp', ['rebuild'], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
