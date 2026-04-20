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

import { existsSync } from 'node:fs';
import { chmod, cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

const rawArgs = process.argv.slice(2);
const scriptArgs = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;

const { values: args } = parseArgs({
  args: scriptArgs,
  options: {
    platform: { type: 'string', default: process.platform },
    arch: { type: 'string', default: process.arch },
  },
});

const platform = args.platform!;
const arch = args.arch!;
const DESKTOP_ROOT = resolve(import.meta.dirname, '..');
const ROOT_NODE_MODULES = resolve(DESKTOP_ROOT, '../../node_modules');
const DIST_DIR = resolve(DESKTOP_ROOT, 'dist');
const BUILD_APP_DIR = resolve(DESKTOP_ROOT, 'build/app');
const TARGET_NODE_MODULES = resolve(BUILD_APP_DIR, '_modules');

/** Runtime native modules that Vite cannot bundle (require native .node bindings). */
const NATIVE_MODULES: string[] = [
  'trzsz',
  'ssh2',
  'node-pty',
  'better-sqlite3',
  'cpu-features',
  '@termlnk/macos-utils',
];

/** Packages needed only at build time — excluded from the final bundle. */
const BUILD_ONLY_PACKAGES = new Set([
  'node-addon-api',
]);

// ---------------------------------------------------------------------------
// Copy-time filter — decides what enters `_modules/` in the first place.
// Anything excluded here is never copied, eliminating the need for a
// post-copy global cleanup pass and avoiding Windows EPERM on restricted
// test fixtures.
// ---------------------------------------------------------------------------

const EXCLUDED_DIRS = new Set([
  '.github',
  '__tests__',
  '__mocks__',
  'test',
  'tests',
  'docs',
  'doc',
  'example',
  'examples',
  'coverage',
]);

const EXCLUDED_NAMES = new Set([
  'Jenkinsfile',
  '.editorconfig',
  'CONTRIBUTING.md',
  'CHANGELOG.md',
  '.drone.yml',
  '.gitattributes',
  'package-lock.json',
]);

const EXCLUDED_SUFFIXES = [
  '.map',
  '.test.js',
  '.d.ts',
  '.d.mts',
  '.d.cts',
  '.d.ts.map',
];

function isNonRuntimeEntry(name: string): boolean {
  return EXCLUDED_DIRS.has(name)
    || EXCLUDED_NAMES.has(name)
    || EXCLUDED_SUFFIXES.some((s) => name.endsWith(s))
    || /^readme(\..*)?$/i.test(name);
}

// ---------------------------------------------------------------------------
// Per-module build artifact cleanup — strips source code, gyp files, and
// compilation intermediates that survive the copy filter (they live in
// directories like `src/`, `deps/`, `build/` which are too generic to
// filter by name alone).
// ---------------------------------------------------------------------------

interface IModuleCleanupRule {
  dirs?: string[];
  files?: string[];
  /** Dirs to remove only when NOT building for this platform. */
  keepDirsOnPlatform?: { platform: string; dirs: string[] };
}

const MODULE_CLEANUP: Record<string, IModuleCleanupRule> = {
  '@types': {},

  'node-pty': {
    dirs: ['build', 'src', 'scripts', 'node-addon-api', 'typings'],
    files: ['binding.gyp'],
    keepDirsOnPlatform: { platform: 'win32', dirs: ['deps', 'third_party'] },
  },

  ssh2: {
    dirs: ['util', 'lib/protocol/crypto/src'],
    files: ['.eslintrc.js', '.eslintignore', 'install.js', 'lib/protocol/crypto/binding.gyp'],
  },

  trzsz: {
    dirs: ['lib/dist/dts'],
  },

  'better-sqlite3': {
    dirs: [
      'deps',
      'src',
      'benchmark',
      'bin',
      'build/Release/obj.target',
      'build/Release/obj',
      'build/Release/obj.gen',
    ],
    files: [
      'binding.gyp',
      'build/Makefile',
      'build/better_sqlite3.target.mk',
      'build/config.gypi',
      'build/gyp-mac-tool',
      'build/Release/test_extension.node',
    ],
  },

  'cpu-features': {
    dirs: [
      'deps',
      'src',
      'build/Release/obj.target',
      'build/Release/obj',
    ],
    files: [
      'binding.gyp',
      'buildcheck.gypi',
      'build/Makefile',
      'build/cpufeatures.target.mk',
      'build/config.gypi',
      'build/gyp-mac-tool',
    ],
  },

  openai: {
    dirs: ['src', 'bin'],
  },

  zod: {
    dirs: ['src'],
  },
};

// ===========================================================================
// Operations
// ===========================================================================

/**
 * Recursively collects all production dependencies for the given packages.
 * Reads each package.json's `dependencies` field and follows the graph.
 */
async function collectRuntimeDeps(rootNodeModules: string, entryModules: string[]): Promise<string[]> {
  const collected: string[] = [];
  const queue = [...entryModules];

  while (queue.length > 0) {
    const pkg = queue.shift()!;
    if (collected.includes(pkg)) {
      continue;
    }

    const pkgDir = resolve(rootNodeModules, pkg);
    if (!existsSync(pkgDir)) {
      continue;
    }

    collected.push(pkg);

    const raw = await readFile(resolve(pkgDir, 'package.json'), 'utf-8');
    const deps = Object.keys(JSON.parse(raw).dependencies ?? {});
    queue.push(...deps);
  }

  return collected.filter((pkg) => !BUILD_ONLY_PACKAGES.has(pkg));
}

/**
 * Copies each dependency from root node_modules into `_modules/`, applying
 * the copy-time filter to exclude non-runtime content at source.
 */
async function stageModules(deps: string[]): Promise<void> {
  await mkdir(TARGET_NODE_MODULES, { recursive: true });

  await Promise.all(
    deps.map(async (dep) => {
      const src = resolve(ROOT_NODE_MODULES, dep);
      const dest = resolve(TARGET_NODE_MODULES, dep);
      if (!existsSync(src) || existsSync(dest)) {
        return;
      }

      await cp(src, dest, {
        recursive: true,
        dereference: true,
        filter: (source) => !isNonRuntimeEntry(basename(source)),
      });
    })
  );
}

/**
 * Removes node-pty prebuilds for platforms other than the target, and
 * ensures spawn-helper is executable.
 */
async function stripPrebuilds(): Promise<void> {
  const prebuildsDir = resolve(TARGET_NODE_MODULES, 'node-pty', 'prebuilds');
  const target = `${platform}-${arch}`;

  if (!existsSync(prebuildsDir)) {
    return;
  }

  const entries = await readdir(prebuildsDir);
  await Promise.all(
    entries
      .filter((entry) => entry !== target)
      .map((entry) => rm(resolve(prebuildsDir, entry), { recursive: true, force: true }))
  );

  const spawnHelper = resolve(prebuildsDir, target, 'spawn-helper');
  if (existsSync(spawnHelper)) {
    await chmod(spawnHelper, 0o755);
  }
}

/**
 * Removes node-pty `bin/` entries compiled by @electron/rebuild for
 * architectures other than the target (e.g. `bin/darwin-x64-143/`).
 */
async function stripNativeBins(): Promise<void> {
  const binDir = resolve(TARGET_NODE_MODULES, 'node-pty', 'bin');
  const target = `${platform}-${arch}`;

  if (!existsSync(binDir)) {
    return;
  }

  const entries = await readdir(binDir);
  await Promise.all(
    entries
      .filter((entry) => !entry.startsWith(target))
      .map((entry) => rm(resolve(binDir, entry), { recursive: true, force: true }))
  );
}

/**
 * Removes build artifacts, source code, and gyp files from staged modules
 * according to the declarative MODULE_CLEANUP rules.
 */
async function stripBuildArtifacts(): Promise<void> {
  const removals: Promise<void>[] = [];

  for (const [pkg, rule] of Object.entries(MODULE_CLEANUP)) {
    const pkgDir = resolve(TARGET_NODE_MODULES, pkg);
    if (!existsSync(pkgDir)) {
      continue;
    }

    for (const dir of rule.dirs ?? []) {
      removals.push(rm(resolve(pkgDir, dir), { recursive: true, force: true }));
    }
    for (const file of rule.files ?? []) {
      removals.push(rm(resolve(pkgDir, file), { force: true }));
    }
    if (rule.keepDirsOnPlatform && platform !== rule.keepDirsOnPlatform.platform) {
      for (const dir of rule.keepDirsOnPlatform.dirs) {
        removals.push(rm(resolve(pkgDir, dir), { recursive: true, force: true }));
      }
    }
  }

  await Promise.all(removals);
}

/**
 * Generates a minimal package.json for the staged app (no dependencies,
 * no scripts — only identity and entry point).
 */
async function generatePackageJson(): Promise<void> {
  const raw = await readFile(resolve(DESKTOP_ROOT, 'package.json'), 'utf-8');
  const pkg = JSON.parse(raw);

  const staged = {
    name: pkg.name,
    version: process.env.RELEASE_VERSION || pkg.version,
    main: pkg.main,
    type: pkg.type,
    description: pkg.description,
    author: pkg.author,
    license: pkg.license,
  };

  await writeFile(
    resolve(BUILD_APP_DIR, 'package.json'),
    JSON.stringify(staged, null, 2),
    'utf-8'
  );
}

// ===========================================================================
// Pipeline
// ===========================================================================

async function main(): Promise<void> {
  console.log(`Staging app for ${platform}-${arch}...`);
  const start = performance.now();

  // 1. Clean previous build
  await rm(BUILD_APP_DIR, { recursive: true, force: true });
  await mkdir(BUILD_APP_DIR, { recursive: true });

  // 2. Copy Vite build output
  if (!existsSync(DIST_DIR)) {
    console.error('Error: dist/ directory not found. Run "pnpm build" first.');
    process.exit(1);
  }
  await cp(DIST_DIR, resolve(BUILD_APP_DIR, 'dist'), { recursive: true });

  // 3. Generate minimal package.json
  await generatePackageJson();

  // 4. Stage runtime native modules (with copy-time filter)
  const deps = await collectRuntimeDeps(ROOT_NODE_MODULES, NATIVE_MODULES);
  await stageModules(deps);

  // 5. Strip non-target platform prebuilds
  await stripPrebuilds();

  // 6. Strip non-target architecture native bins
  await stripNativeBins();

  // 7. Strip build artifacts from staged modules
  await stripBuildArtifacts();

  const elapsed = ((performance.now() - start) / 1000).toFixed(1);
  console.log(`Staged build/app/ in ${elapsed}s (${platform}-${arch})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
