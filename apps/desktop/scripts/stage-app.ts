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
import { basename, dirname, resolve } from 'node:path';
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
const MODULE_SOURCE_DIRS = [
  resolve(DESKTOP_ROOT, 'node_modules'),
  resolve(DESKTOP_ROOT, '../../node_modules'),
];
const DIST_DIR = resolve(DESKTOP_ROOT, 'dist');
const BUILD_APP_DIR = resolve(DESKTOP_ROOT, 'build/app');
const TARGET_NODE_MODULES = resolve(BUILD_APP_DIR, 'node_modules');

/** Runtime native modules that Vite cannot bundle (require native .node bindings). */
interface IRuntimeModule {
  name: string;
  optional?: boolean;
  platforms?: string[];
}

interface IResolvedModule {
  name: string;
  dir: string;
  version: string;
}

interface IModuleRequest {
  name: string;
  optional?: boolean;
  parentDir?: string;
}

const RUNTIME_MODULES: IRuntimeModule[] = [
  { name: 'trzsz' },
  { name: 'ssh2' },
  { name: 'node-pty' },
  { name: 'better-sqlite3' },
  { name: 'cpu-features' },
  { name: '@termlnk/macos-utils', optional: true, platforms: ['darwin'] },
];

/** Packages needed only at build time — excluded from the final bundle. */
const BUILD_ONLY_PACKAGES = new Set([
  'node-addon-api',
]);

// ---------------------------------------------------------------------------
// Copy-time filter — decides what enters staged node_modules in the first place.
// Anything excluded here is never copied, eliminating the need for a
// post-copy global cleanup pass and avoiding Windows EPERM on restricted
// test fixtures.
//
// Matching is by `basename` only (no path context). When adding entries here,
// confirm the name is unambiguously non-runtime across every staged module —
// `obj.target` / `binding.gyp` are safe (only emitted by node-gyp for native
// modules), but generic names like `src` or `bin` are NOT safe and must stay
// in the per-module MODULE_CLEANUP table.
// ---------------------------------------------------------------------------

const EXCLUDED_DIRS = new Set([
  '.github',
  '.turbo',
  '.cache',
  '__tests__',
  '__mocks__',
  'test',
  'tests',
  'docs',
  'doc',
  'example',
  'examples',
  'coverage',
  // node-gyp build intermediates (always under build/Release/, only present
  // for native modules — safe to drop globally).
  'obj.target',
  '.deps',
]);

const EXCLUDED_NAMES = new Set([
  'Jenkinsfile',
  '.editorconfig',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.json',
  '.eslintignore',
  '.gitignore',
  '.gitkeep',
  '.gitattributes',
  '.npmignore',
  '.drone.yml',
  'CONTRIBUTING.md',
  'CHANGELOG.md',
  'package-lock.json',
  // node-gyp project / build files. Only emitted for native modules; the
  // compiled `.node` under build/Release/ is unaffected (different basename).
  'binding.gyp',
  'binding.Makefile',
  'Makefile',
  'gyp-mac-tool',
]);

const EXCLUDED_SUFFIXES = [
  '.map',
  '.test.js',
  '.d.ts',
  '.d.mts',
  '.d.cts',
  '.d.ts.map',
  // node-gyp generated targets (e.g. better_sqlite3.target.mk) and gyp
  // include files (e.g. config.gypi, buildcheck.gypi).
  '.target.mk',
  '.gypi',
];

function isNonRuntimeEntry(name: string): boolean {
  return EXCLUDED_DIRS.has(name)
    || EXCLUDED_NAMES.has(name)
    || EXCLUDED_SUFFIXES.some((s) => name.endsWith(s))
    || /^readme(\..*)?$/i.test(name);
}

// ---------------------------------------------------------------------------
// Per-module build artifact cleanup — strips package-specific paths the
// global filter cannot safely reach (anything under a generic name like
// `src/`, `bin/`, `deps/` that some packages ship as runtime content but
// these particular ones do not).
//
// node-gyp project files (binding.gyp, *.target.mk, config.gypi, etc.) and
// build intermediates (obj.target, .deps) are handled by the global filter
// in EXCLUDED_DIRS / EXCLUDED_NAMES / EXCLUDED_SUFFIXES — do not duplicate
// them here.
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
    dirs: ['src', 'scripts', 'node-addon-api', 'typings'],
    keepDirsOnPlatform: { platform: 'win32', dirs: ['deps', 'third_party'] },
  },

  ssh2: {
    dirs: ['util', 'lib/protocol/crypto/src'],
    files: ['install.js'],
  },

  trzsz: {
    dirs: ['lib/dist/dts'],
  },

  'better-sqlite3': {
    dirs: ['deps', 'src', 'benchmark', 'bin'],
    files: ['build/Release/test_extension.node'],
  },

  'cpu-features': {
    dirs: ['deps', 'src'],
  },

  openai: {
    dirs: ['src', 'bin'],
  },

  zod: {
    dirs: ['src'],
  },

  // NOTE: do not add rules for `@termlnk/macos-utils` (or any monorepo
  // workspace package) here. electron-builder treats workspace dependencies
  // declared with `workspace:*` as monorepo-aware: it re-copies them from
  // their source directory into `app.asar.unpacked` after staging, bypassing
  // both this cleanup table and the `files` filter in electron-builder.ts.
  // Any rule placed here would mutate only the staged copy, which is then
  // overwritten in the final artifact — silently ineffective. The ~25 KB
  // of source/tooling files that ship with macos-utils as a result are
  // accepted (this matches how Logseq, Joplin, Hyper and Element ship their
  // workspace-resident native deps).
};

// ===========================================================================
// Operations
// ===========================================================================

function resolveInstalledModule(pkg: string, parentDir?: string): string | undefined {
  // Walk up from `parentDir` collecting every `node_modules` along the way,
  // then fall back to the workspace-level sources. `dirname` returns the same
  // path when called on the filesystem root, which terminates the loop.
  const searchDirs: string[] = [];
  if (parentDir) {
    let current = parentDir;
    while (true) {
      searchDirs.push(resolve(current, 'node_modules'));
      const next = dirname(current);
      if (next === current) {
        break;
      }
      current = next;
    }
  }
  searchDirs.push(...MODULE_SOURCE_DIRS);

  for (const nodeModulesDir of searchDirs) {
    const pkgDir = resolve(nodeModulesDir, pkg);
    if (existsSync(resolve(pkgDir, 'package.json'))) {
      return pkgDir;
    }
  }

  return undefined;
}

function getRuntimeModules(): IRuntimeModule[] {
  return RUNTIME_MODULES.filter((module) => {
    return !module.platforms || module.platforms.includes(platform);
  });
}

/**
 * Recursively collects all installed runtime dependencies for the given
 * packages. Reads each package.json's production dependency fields and follows
 * the graph using the same installed modules that will be copied.
 *
 * Optional propagation: a transitive dep is treated as optional if the parent
 * link is optional OR any ancestor on the chain is optional. This avoids
 * throwing when a missing leaf is reachable only through an optional branch.
 *
 * Multi-version detection: if the same package name resolves to two distinct
 * physical directories (different versions in the dependency graph), we throw.
 * The flat staging layout cannot host both, so silently dropping one would
 * load the wrong version at runtime.
 */
async function collectRuntimeDeps(entryModules: IRuntimeModule[]): Promise<IResolvedModule[]> {
  const byName = new Map<string, IResolvedModule>();
  const seenDirs = new Set<string>();
  const queue: IModuleRequest[] = entryModules.map((entry) => ({
    name: entry.name,
    optional: entry.optional,
  }));

  while (queue.length > 0) {
    const request = queue.shift()!;
    if (BUILD_ONLY_PACKAGES.has(request.name)) {
      continue;
    }

    const pkgDir = resolveInstalledModule(request.name, request.parentDir);
    if (!pkgDir) {
      if (!request.optional) {
        throw new Error(`Required runtime dependency "${request.name}" is not installed.`);
      }
      continue;
    }
    if (seenDirs.has(pkgDir)) {
      continue;
    }
    seenDirs.add(pkgDir);

    const raw = await readFile(resolve(pkgDir, 'package.json'), 'utf-8');
    const packageJson = JSON.parse(raw);
    const name: string = packageJson.name ?? request.name;
    const version: string = packageJson.version ?? '*';

    const existing = byName.get(name);
    if (existing && existing.dir !== pkgDir) {
      throw new Error(
        `Multiple installed versions of "${name}" reachable from runtime entry points: `
        + `${existing.version} at ${existing.dir} and ${version} at ${pkgDir}. `
        + 'Flat node_modules staging cannot host both — please align versions in the workspace.'
      );
    }
    byName.set(name, { name, dir: pkgDir, version });

    const required = new Set(Object.keys(packageJson.dependencies ?? {}));
    const optional = new Set(Object.keys(packageJson.optionalDependencies ?? {}));
    for (const dep of new Set([...required, ...optional])) {
      // A link is optional only when listed *exclusively* in optionalDependencies
      // (a name in `dependencies` always wins). The child inherits the parent's
      // optional state so a chain through any optional link stays optional.
      const linkOptional = !required.has(dep) && optional.has(dep);
      queue.push({
        name: dep,
        optional: request.optional || linkOptional,
        parentDir: pkgDir,
      });
    }
  }

  return [...byName.values()];
}

/**
 * Copies each dependency from installed node_modules into staged node_modules, applying
 * the copy-time filter to exclude non-runtime content at source.
 */
async function stageModules(deps: IResolvedModule[]): Promise<void> {
  await mkdir(TARGET_NODE_MODULES, { recursive: true });

  await Promise.all(
    deps.map(async (dep) => {
      const dest = resolve(TARGET_NODE_MODULES, dep.name);
      if (existsSync(dest)) {
        return;
      }

      await cp(dep.dir, dest, {
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
 * Generates a minimal package.json for the staged app. Only the top-level
 * runtime modules are declared as dependencies — transitive packages are
 * present on disk but not advertised, so `npm ls` against the staged tree
 * resolves cleanly without ELSPROBLEMS noise from a flattened graph.
 */
async function generatePackageJson(runtimeModules: IRuntimeModule[], stagedModules: IResolvedModule[]): Promise<void> {
  const raw = await readFile(resolve(DESKTOP_ROOT, 'package.json'), 'utf-8');
  const pkg = JSON.parse(raw);
  const stagedByName = new Map(stagedModules.map((module) => [module.name, module]));
  const dependencies: Record<string, string> = {};
  const optionalDependencies: Record<string, string> = {};

  for (const entry of runtimeModules) {
    const installed = stagedByName.get(entry.name);
    if (!installed) {
      continue;
    }

    const target = entry.optional ? optionalDependencies : dependencies;
    target[entry.name] = installed.version;
  }

  const staged = {
    name: pkg.name,
    version: process.env.RELEASE_VERSION || pkg.version,
    main: pkg.main,
    type: pkg.type,
    description: pkg.description,
    author: pkg.author,
    license: pkg.license,
    dependencies,
    optionalDependencies,
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

  // 1. Verify prerequisites before mutating anything on disk
  if (!existsSync(DIST_DIR)) {
    console.error('Error: dist/ directory not found. Run "pnpm build" first.');
    process.exit(1);
  }

  // 2. Clean previous build
  await rm(BUILD_APP_DIR, { recursive: true, force: true });
  await mkdir(BUILD_APP_DIR, { recursive: true });

  // 3. Copy Vite build output
  await cp(DIST_DIR, resolve(BUILD_APP_DIR, 'dist'), { recursive: true });

  const runtimeModules = getRuntimeModules();

  // 4. Collect runtime native modules and their production dependency graph
  const deps = await collectRuntimeDeps(runtimeModules);

  // 5. Generate minimal package.json
  await generatePackageJson(runtimeModules, deps);

  // 6. Stage runtime native modules (with copy-time filter)
  await stageModules(deps);

  // 7. Strip non-target platform prebuilds
  await stripPrebuilds();

  // 8. Strip non-target architecture native bins
  await stripNativeBins();

  // 9. Strip build artifacts from staged modules
  await stripBuildArtifacts();

  const elapsed = ((performance.now() - start) / 1000).toFixed(1);
  console.log(`Staged build/app/ in ${elapsed}s (${platform}-${arch})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
