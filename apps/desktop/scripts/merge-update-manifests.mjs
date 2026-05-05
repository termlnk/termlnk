import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import yaml from 'js-yaml';

/**
 * Merge electron-builder per-arch update manifests into the channel files
 * electron-updater consumes. Only platforms whose channel filename collides
 * across architectures need merging:
 *   - latest-mac.yml ← mac arm64 + mac x64 (electron-builder uses one name for both archs)
 *   - latest.yml     ← win arm64 + win x64 (same)
 *
 * Linux is intentionally excluded: electron-builder writes
 * `latest-linux.yml` for x64 and `latest-linux-arm64.yml` for arm64 already,
 * so each linux job uploads its own file directly — no merge needed.
 *
 * The merge concatenates the `files` arrays (deduplicated by url). Top-level
 * metadata (version / releaseDate / path / sha512) is taken from the first
 * available input — electron-updater consults the `files` array for
 * arch-aware lookup, so the top-level fields are informational only.
 *
 * Single-arch fallback: if only one input is present, it is copied as-is.
 * A missing target with zero inputs is skipped (not an error) so a partial
 * release (e.g. one arch failing to build) still produces the manifests it
 * can — but the script exits non-zero if every target is empty.
 *
 * @typedef {{ url: string, sha512: string, size: number, blockMapSize?: number }} ManifestFile
 * @typedef {{ version: string, files: ManifestFile[], path?: string, sha512?: string, releaseDate?: string }} UpdateManifest
 * @typedef {{ output: string, inputs: string[] }} MergeTarget
 */

const { values: args } = parseArgs({
  options: {
    'input-dir': { type: 'string', default: '.' },
    'output-dir': { type: 'string', default: '.' },
  },
});

const INPUT_DIR = resolve(args['input-dir']);
const OUTPUT_DIR = resolve(args['output-dir']);

/** @type {MergeTarget[]} */
const TARGETS = [
  {
    output: 'latest-mac.yml',
    inputs: [
      'latest-mac-arm64/latest-mac.yml',
      'latest-mac-x64/latest-mac.yml',
    ],
  },
  {
    output: 'latest.yml',
    inputs: [
      'latest-win-arm64/latest.yml',
      'latest-win-x64/latest.yml',
    ],
  },
];

/**
 * @param {string} filePath
 * @returns {Promise<UpdateManifest | null>}
 */
async function readManifest(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  const raw = await readFile(filePath, 'utf8');
  const parsed = yaml.load(raw);

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError(`${filePath} is not a YAML mapping`);
  }

  const manifest = /** @type {UpdateManifest} */ (parsed);

  if (!Array.isArray(manifest.files)) {
    throw new TypeError(`${filePath} is missing a "files" array`);
  }

  return manifest;
}

/**
 * @param {UpdateManifest[]} manifests
 * @returns {UpdateManifest}
 */
function mergeManifests(manifests) {
  const [base] = manifests;
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {ManifestFile[]} */
  const files = [];

  for (const manifest of manifests) {
    for (const file of manifest.files) {
      if (seen.has(file.url)) {
        continue;
      }
      seen.add(file.url);
      files.push(file);
    }
  }

  return { ...base, files };
}

async function main() {
  let mergedCount = 0;
  let skippedCount = 0;

  for (const { output, inputs } of TARGETS) {
    /** @type {UpdateManifest[]} */
    const manifests = [];
    for (const relative of inputs) {
      const absolute = resolve(INPUT_DIR, relative);
      const manifest = await readManifest(absolute);
      if (manifest === null) {
        console.log(`[skip] ${relative} not found`);
        continue;
      }
      manifests.push(manifest);
    }

    if (manifests.length === 0) {
      console.log(`[skip] ${output} — no inputs available`);
      skippedCount++;
      continue;
    }

    const result = manifests.length === 1 ? manifests[0] : mergeManifests(manifests);
    const outputPath = resolve(OUTPUT_DIR, output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(
      outputPath,
      yaml.dump(result, { lineWidth: -1, noRefs: true }),
      'utf8'
    );
    console.log(`[ok] ${output} ← ${manifests.length} input(s), ${result.files.length} file entr${result.files.length === 1 ? 'y' : 'ies'}`);
    mergedCount++;
  }

  console.log(`\n${mergedCount} merged, ${skippedCount} skipped.`);

  if (mergedCount === 0) {
    console.error('[error] no manifests were produced; check that input artifacts exist under', INPUT_DIR);
    process.exit(1);
  }
}

await main();
