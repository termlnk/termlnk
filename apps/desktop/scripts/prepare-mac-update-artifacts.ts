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

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, extname, resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import yaml from 'js-yaml';

interface IManifestFile {
  url: string;
  sha512: string;
  size: number;
  blockMapSize?: number;
}

interface IUpdateManifest {
  version: string;
  files: IManifestFile[];
  path?: string;
  sha512?: string;
  releaseNotes?: string;
  releaseDate?: string;
}

interface IBuildBlockMapResult {
  size: number;
  sha512: string;
}

interface IDesktopPackageJson {
  version?: unknown;
}

interface IElectronBuilderConfig {
  productName?: string;
}

const MAC_ZIP_PATTERN = /-mac-([^.]+)\.zip$/;
const MAC_DMG_PATTERN = /-mac-([^.]+)\.dmg$/;

const require = createRequire(import.meta.url);
const builderConfig = require('../electron-builder').default as IElectronBuilderConfig;
const { buildBlockMap } = require('app-builder-lib/out/targets/blockmap/blockmap.js') as {
  buildBlockMap: (file: string, compressionFormat: 'gzip', outFile: string) => Promise<IBuildBlockMapResult>;
};

const { values: args } = parseArgs({
  options: {
    'release-dir': { type: 'string', default: 'release' },
    'release-notes': { type: 'string', default: 'build/release-notes.md' },
    manifest: { type: 'string', default: 'latest-mac.yml' },
  },
});

const DESKTOP_ROOT = resolve(import.meta.dirname, '..');
const RELEASE_DIR = resolve(DESKTOP_ROOT, args['release-dir']!);
const RELEASE_NOTES_PATH = resolve(DESKTOP_ROOT, args['release-notes']!);
const MANIFEST_PATH = resolve(RELEASE_DIR, args.manifest!);
const VERIFY_GATEKEEPER = ['1', 'true'].includes(String(process.env.TERMLNK_VERIFY_GATEKEEPER ?? '').toLowerCase());

function run(command: string, commandArgs: string[], cwd?: string): string {
  return execFileSync(command, commandArgs, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function readManifest(raw: string): IUpdateManifest {
  const parsed = yaml.load(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError(`${MANIFEST_PATH} is not a YAML mapping.`);
  }

  const manifest = parsed as IUpdateManifest;
  if (!Array.isArray(manifest.files)) {
    throw new TypeError(`${MANIFEST_PATH} is missing a "files" array.`);
  }

  return manifest;
}

async function readManifestOrDefault(): Promise<IUpdateManifest> {
  if (!existsSync(MANIFEST_PATH)) {
    return {
      version: readPackageVersion(),
      files: [],
    };
  }

  return readManifest(await readFile(MANIFEST_PATH, 'utf8'));
}

function readPackageVersion(): string {
  const releaseVersion = process.env.RELEASE_VERSION?.replace(/^v/, '');
  if (releaseVersion) {
    return releaseVersion;
  }

  const packageJsonPath = resolve(DESKTOP_ROOT, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as IDesktopPackageJson;

  if (typeof packageJson.version !== 'string' || packageJson.version.length === 0) {
    throw new TypeError(`${packageJsonPath} is missing a string "version".`);
  }

  return packageJson.version;
}

function readProductName(): string {
  if (typeof builderConfig.productName === 'string' && builderConfig.productName.length > 0) {
    return builderConfig.productName;
  }

  throw new TypeError('electron-builder.ts is missing a string "productName".');
}

async function applyReleaseMetadata(manifest: IUpdateManifest): Promise<void> {
  if (!manifest.releaseDate) {
    manifest.releaseDate = new Date().toISOString();
  }

  if (!manifest.releaseNotes && existsSync(RELEASE_NOTES_PATH)) {
    manifest.releaseNotes = await readFile(RELEASE_NOTES_PATH, 'utf8');
  }
}

function inferArch(artifactName: string): string | null {
  const match = artifactName.match(MAC_ZIP_PATTERN) ?? artifactName.match(MAC_DMG_PATTERN);
  return match?.[1] ?? null;
}

function toZipFile(file: IManifestFile): IManifestFile | null {
  const zipUrl = file.url.replace(MAC_DMG_PATTERN, '-mac-$1.zip');
  if (zipUrl === file.url) {
    return null;
  }

  return {
    url: zipUrl,
    sha512: '',
    size: 0,
  };
}

function collectZipFiles(manifest: IUpdateManifest): IManifestFile[] {
  const zipFiles = manifest.files.filter((file) => extname(file.url) === '.zip');
  if (zipFiles.length > 0) {
    return zipFiles;
  }

  const inferredZipFiles = manifest.files
    .map((file) => toZipFile(file))
    .filter((file): file is IManifestFile => !!file);

  if (inferredZipFiles.length > 0) {
    manifest.files = [
      ...inferredZipFiles,
      ...manifest.files,
    ];
  }

  return inferredZipFiles;
}

async function listReleaseFiles(extension: string): Promise<string[]> {
  if (!existsSync(RELEASE_DIR)) {
    return [];
  }

  const names = await readdir(RELEASE_DIR);
  return names
    .filter((name) => extname(name) === extension)
    .sort();
}

function toZipName(appPath: string, arch: string | null): string {
  const archSuffix = arch ? `-${arch}` : '';
  return `${readProductName()}-${readPackageVersion()}-mac${archSuffix}.zip`;
}

async function discoverZipFiles(manifest: IUpdateManifest): Promise<IManifestFile[]> {
  const manifestZipFiles = collectZipFiles(manifest);
  if (manifestZipFiles.length > 0) {
    return manifestZipFiles;
  }

  const appPath = findAppBundle(null);
  const dmgFiles = await listReleaseFiles('.dmg');
  const dmgZipFiles = dmgFiles
    .map((name) => toZipFile({ url: name, sha512: '', size: 0 }))
    .filter((file): file is IManifestFile => !!file);

  const zipFiles = dmgZipFiles.length > 0
    ? dmgZipFiles
    : [{ url: toZipName(appPath, null), sha512: '', size: 0 }];

  manifest.files = [
    ...zipFiles,
    ...manifest.files,
  ];

  return zipFiles;
}

function findAppBundle(artifactName: string | null): string {
  const arch = artifactName ? inferArch(artifactName) : null;
  const roots = [
    arch ? resolve(RELEASE_DIR, `mac-${arch}`) : null,
    resolve(RELEASE_DIR, 'mac'),
    RELEASE_DIR,
  ].filter((root): root is string => !!root);

  const candidates: string[] = [];
  for (const root of roots) {
    if (!existsSync(root)) {
      continue;
    }
    const output = run('find', [root, '-maxdepth', '2', '-name', '*.app', '-type', 'd']);
    candidates.push(...output.split('\n').filter(Boolean));
  }

  const unique = [...new Set(candidates)];
  if (unique.length !== 1) {
    throw new Error(
      `Expected exactly one .app bundle for ${artifactName ?? 'mac update zip'}, found ${unique.length}: ${unique.join(', ')}`
    );
  }

  return unique[0]!;
}

async function sha512Base64(file: string): Promise<string> {
  const hash = createHash('sha512');
  const { createReadStream } = await import('node:fs');

  await new Promise<void>((resolvePromise, reject) => {
    const stream = createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolvePromise);
  });

  return hash.digest('base64');
}

async function rebuildZip(appPath: string, zipPath: string): Promise<void> {
  await rm(zipPath, { force: true });
  run('ditto', [
    '-c',
    '-k',
    '--sequesterRsrc',
    '--keepParent',
    appPath,
    zipPath,
  ]);
}

async function rebuildBlockMap(zipPath: string): Promise<void> {
  const blockMapPath = `${zipPath}.blockmap`;
  await rm(blockMapPath, { force: true });
  await buildBlockMap(zipPath, 'gzip', blockMapPath);
}

function assertFrameworkSymlinks(appPath: string): void {
  const frameworksDir = resolve(appPath, 'Contents/Frameworks');
  if (!existsSync(frameworksDir)) {
    return;
  }

  const frameworks = run('find', [frameworksDir, '-maxdepth', '1', '-name', '*.framework', '-type', 'd'])
    .split('\n')
    .filter(Boolean);

  for (const framework of frameworks) {
    const currentPath = resolve(framework, 'Versions/Current');
    if (existsSync(currentPath)) {
      const type = run('stat', ['-f', '%HT', currentPath]).trim();
      if (type !== 'Symbolic Link') {
        throw new Error(`${currentPath} must be a symlink, got ${type}.`);
      }
    }

    const resourcesPath = resolve(framework, 'Resources');
    if (existsSync(resolve(framework, 'Versions')) && existsSync(resourcesPath)) {
      const type = run('stat', ['-f', '%HT', resourcesPath]).trim();
      if (type !== 'Symbolic Link') {
        throw new Error(`${resourcesPath} must be a symlink, got ${type}.`);
      }
    }
  }
}

async function verifyZip(zipPath: string): Promise<void> {
  const tempDir = await mkdtemp(resolve(tmpdir(), 'termlnk-mac-update-'));
  try {
    run('ditto', ['-x', '-k', zipPath, tempDir]);

    const apps = run('find', [tempDir, '-maxdepth', '1', '-name', '*.app', '-type', 'd'])
      .split('\n')
      .filter(Boolean);

    if (apps.length !== 1) {
      throw new Error(`Expected one app bundle after extracting ${basename(zipPath)}, found ${apps.length}.`);
    }

    const appPath = apps[0]!;
    assertFrameworkSymlinks(appPath);
    run('codesign', ['--verify', '--deep', '--strict', '--verbose=4', appPath]);
    if (VERIFY_GATEKEEPER) {
      run('xcrun', ['stapler', 'validate', appPath]);
      run('spctl', ['--assess', '--type', 'execute', '--verbose=4', appPath]);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function updateManifestFile(manifest: IUpdateManifest, file: IManifestFile): Promise<void> {
  const zipPath = resolve(RELEASE_DIR, file.url);
  const zipStats = await stat(zipPath);
  if (zipStats.size === 0) {
    throw new Error(`${zipPath} is empty.`);
  }
  const nextSha512 = await sha512Base64(zipPath);

  file.size = zipStats.size;
  file.sha512 = nextSha512;
  delete file.blockMapSize;

  const manifestPath = manifest.path ?? '';
  if (extname(manifestPath) !== '.zip' || manifestPath === file.url || basename(manifestPath) === basename(file.url)) {
    manifest.path = file.url;
    manifest.sha512 = nextSha512;
  }
}

async function syncDmgManifestFiles(manifest: IUpdateManifest): Promise<void> {
  const existingUrls = new Set(manifest.files.map((file) => file.url));
  const dmgNames = await listReleaseFiles('.dmg');

  for (const name of dmgNames) {
    const dmgPath = resolve(RELEASE_DIR, name);
    const dmgStats = await stat(dmgPath);
    if (dmgStats.size === 0) {
      throw new Error(`${dmgPath} is empty.`);
    }
    const sha512 = await sha512Base64(dmgPath);
    const existing = manifest.files.find((file) => file.url === name);

    if (existing) {
      existing.size = dmgStats.size;
      existing.sha512 = sha512;
      delete existing.blockMapSize;
      continue;
    }

    if (!existingUrls.has(name)) {
      manifest.files.push({ url: name, sha512, size: dmgStats.size });
      existingUrls.add(name);
    }
  }
}

async function main(): Promise<void> {
  if (process.platform !== 'darwin') {
    throw new Error('prepare-mac-update-artifacts must run on macOS because it relies on ditto/codesign bundle semantics.');
  }

  const manifest = await readManifestOrDefault();
  const zipFiles = await discoverZipFiles(manifest);
  if (zipFiles.length === 0) {
    throw new Error(`${RELEASE_DIR} does not contain enough macOS output to derive an update zip.`);
  }

  for (const file of zipFiles) {
    const zipPath = resolve(RELEASE_DIR, file.url);
    const appPath = findAppBundle(file.url);

    console.log(`[mac-update] rebuilding ${basename(zipPath)} from ${appPath}`);
    await rebuildZip(appPath, zipPath);

    console.log(`[mac-update] rebuilding ${basename(zipPath)}.blockmap`);
    await rebuildBlockMap(zipPath);

    console.log(`[mac-update] verifying ${basename(zipPath)}`);
    await verifyZip(zipPath);

    await updateManifestFile(manifest, file);
  }

  await syncDmgManifestFiles(manifest);
  await applyReleaseMetadata(manifest);

  await writeFile(
    MANIFEST_PATH,
    yaml.dump(manifest, { lineWidth: -1, noRefs: true }),
    'utf8'
  );

  console.log(`[mac-update] updated ${MANIFEST_PATH}`);
}

await main();
