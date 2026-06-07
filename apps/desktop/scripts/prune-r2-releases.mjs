import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import yaml from 'js-yaml';

/**
 * Prune stale desktop release artifacts from the Cloudflare R2 update bucket.
 *
 * R2 is the auto-update distribution source (electron-builder `publish.url`),
 * not a history archive — GitHub Releases already keeps every artifact. But
 * every release uploads version-stamped objects (Termlnk-<version>-<os>-<arch>.<ext>)
 * flat under one prefix, and nothing ever removes the old ones, so the bucket
 * grows without bound. This script keeps only the most recent N stable
 * versions plus the most recent M prerelease versions per channel, and deletes
 * the rest.
 *
 * Safety invariants (in priority order):
 *   1. The live channel files (latest/alpha/beta/rc*.yml) and every artifact they reference
 *      are NEVER deleted — they are read fresh from R2 to build a protected
 *      set, so whatever electron-updater is currently serving stays intact.
 *   2. If no channel manifest can be read, we refuse to prune — without the channel
 *      manifests we cannot tell what is live, so deleting anything is unsafe.
 *   3. Objects whose name we cannot parse a version from are left untouched.
 *
 * electron-updater (generic provider) only ever fetches channel manifests and
 * the files they reference; it never reaches for older version artifacts. So
 * removing artifacts outside the keep-window has zero effect on updates.
 *
 * Usage:
 *   node prune-r2-releases.mjs --bucket <name> --endpoint <url> [--prefix desktop/] [--keep 2] [--keep-prerelease 2] [--dry-run]
 *
 * Credentials are read from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY by the
 * AWS CLI, matching how the release workflows upload.
 */

const { values: args } = parseArgs({
  options: {
    bucket: { type: 'string' },
    endpoint: { type: 'string' },
    prefix: { type: 'string', default: 'desktop/' },
    keep: { type: 'string', default: '2' },
    'keep-prerelease': { type: 'string', default: '2' },
    'dry-run': { type: 'boolean', default: false },
  },
});

const BUCKET = args.bucket ?? process.env.R2_BUCKET_NAME;
const ENDPOINT = args.endpoint ?? process.env.R2_ENDPOINT;
const KEEP = Number.parseInt(args.keep, 10);
const KEEP_PRERELEASE = Number.parseInt(args['keep-prerelease'], 10);
const DRY_RUN = args['dry-run'];
let PREFIX = args.prefix ?? 'desktop/';
if (PREFIX && !PREFIX.endsWith('/')) {
  PREFIX += '/';
}

// R2 expects an explicit region; 'auto' is its standard value. Only set it as a
// fallback so an environment that already configured a region is left alone.
process.env.AWS_DEFAULT_REGION ??= 'auto';

if (!BUCKET || !ENDPOINT) {
  console.error('[error] --bucket/--endpoint (or R2_BUCKET_NAME/R2_ENDPOINT) are required');
  process.exit(1);
}

if (!Number.isInteger(KEEP) || KEEP < 1) {
  console.error(`[error] --keep must be a positive integer, got "${args.keep}"`);
  process.exit(1);
}

if (!Number.isInteger(KEEP_PRERELEASE) || KEEP_PRERELEASE < 0) {
  console.error(`[error] --keep-prerelease must be a non-negative integer, got "${args['keep-prerelease']}"`);
  process.exit(1);
}

// electron-builder names every artifact <productName>-<version>-<os>-<arch>.<ext>
// (and the nsis -setup.exe / *.blockmap variants share the same head). The
// version is the segment between the first non-greedy product head and a known
// os token, so we anchor on the os to stay product-name agnostic.
const ARTIFACT_RE = /^.+?-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)-(?:mac|win|linux)\b/;
const CHANNEL_MANIFEST_RE = /(?:^|\/)(?:latest|alpha|beta|rc)[^/]*\.yml$/;
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

/**
 * @param {string[]} cliArgs
 * @returns {string}
 */
function aws(cliArgs) {
  return execFileSync('aws', cliArgs, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

/**
 * @returns {{ key: string, size: number }[]}
 */
function listObjects() {
  // The AWS CLI auto-paginates list-objects-v2 and merges every page into one
  // Contents array, so a single call returns the full listing.
  const out = aws([
    's3api',
    'list-objects-v2',
    '--bucket',
    BUCKET,
    '--prefix',
    PREFIX,
    '--endpoint-url',
    ENDPOINT,
    '--output',
    'json',
  ]);
  const parsed = out.trim() ? JSON.parse(out) : {};
  return (parsed.Contents ?? []).map((entry) => ({ key: entry.Key, size: entry.Size ?? 0 }));
}

/**
 * Relative artifact filenames referenced by one channel manifest.
 * @param {string} key
 * @returns {Set<string>}
 */
function readManifestReferences(key) {
  const raw = aws(['s3', 'cp', `s3://${BUCKET}/${key}`, '-', '--endpoint-url', ENDPOINT]);
  const doc = yaml.load(raw);
  const names = new Set();

  if (doc !== null && typeof doc === 'object' && !Array.isArray(doc)) {
    if (typeof doc.path === 'string') {
      names.add(decodeURIComponent(doc.path));
    }
    if (Array.isArray(doc.files)) {
      for (const file of doc.files) {
        if (file && typeof file.url === 'string') {
          names.add(decodeURIComponent(file.url));
        }
      }
    }
  }

  return names;
}

/**
 * @param {string} version
 * @returns {{ major: number, minor: number, patch: number, prerelease: string[] } | null}
 */
function parseVersion(version) {
  const match = SEMVER_RE.exec(version);
  if (match === null) {
    return null;
  }

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
    prerelease: match[4] ? match[4].split('.') : [],
  };
}

/**
 * Compare two semver identifiers, oldest first.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function comparePrereleaseIdentifierAsc(a, b) {
  const aNumber = /^\d+$/.test(a);
  const bNumber = /^\d+$/.test(b);
  if (aNumber && bNumber) {
    return Number.parseInt(a, 10) - Number.parseInt(b, 10);
  }
  if (aNumber !== bNumber) {
    return aNumber ? -1 : 1;
  }
  return a.localeCompare(b);
}

/**
 * Compare two semver versions, newest first.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function compareVersionDesc(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (pa === null || pb === null) {
    return b.localeCompare(a);
  }

  for (const key of ['major', 'minor', 'patch']) {
    if (pa[key] !== pb[key]) {
      return pb[key] - pa[key];
    }
  }

  if (pa.prerelease.length === 0 && pb.prerelease.length === 0) {
    return 0;
  }
  if (pa.prerelease.length === 0) {
    return -1;
  }
  if (pb.prerelease.length === 0) {
    return 1;
  }

  const length = Math.max(pa.prerelease.length, pb.prerelease.length);
  for (let i = 0; i < length; i++) {
    const ai = pa.prerelease[i];
    const bi = pb.prerelease[i];
    if (ai === undefined) {
      return 1;
    }
    if (bi === undefined) {
      return -1;
    }
    const compared = comparePrereleaseIdentifierAsc(ai, bi);
    if (compared !== 0) {
      return -compared;
    }
  }
  return 0;
}

/**
 * @param {string} version
 * @returns {string | null}
 */
function prereleaseChannel(version) {
  const parsed = parseVersion(version);
  return parsed && parsed.prerelease.length > 0 ? parsed.prerelease[0] : null;
}

/**
 * @param {number} bytes
 * @returns {string}
 */
function humanSize(bytes) {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function main() {
  const objects = listObjects();
  const totalBytes = objects.reduce((sum, o) => sum + o.size, 0);
  console.log(`Found ${objects.length} object(s) under ${PREFIX} (${humanSize(totalBytes)} total)`);

  const manifestKeys = objects.filter((o) => CHANNEL_MANIFEST_RE.test(o.key)).map((o) => o.key);
  if (manifestKeys.length === 0) {
    console.error('[error] no channel manifests found under prefix; refusing to prune (cannot determine the live channels)');
    process.exit(1);
  }

  // Protected set: channel manifests themselves + every artifact they reference.
  const protectedKeys = new Set(manifestKeys);
  for (const key of manifestKeys) {
    for (const name of readManifestReferences(key)) {
      protectedKeys.add(PREFIX + name);
      // electron-updater fetches `<file>.blockmap` for differential updates, but
      // manifests only list the main package url. Protect the blockmap too so the
      // live version (e.g. a prerelease outside the stable keep-window) keeps its
      // delta-update capability. A no-op key when no blockmap exists (e.g. dmg).
      protectedKeys.add(`${PREFIX}${name}.blockmap`);
    }
  }

  const versioned = [];
  const stableVersions = new Set();
  const prereleaseVersionsByChannel = new Map();
  for (const object of objects) {
    if (manifestKeys.includes(object.key)) {
      continue;
    }
    const name = object.key.startsWith(PREFIX) ? object.key.slice(PREFIX.length) : object.key;
    const match = ARTIFACT_RE.exec(name);
    if (match === null) {
      continue; // unrecognized object — leave it untouched
    }
    const version = match[1];
    const channel = prereleaseChannel(version);
    versioned.push({ ...object, version, channel });
    if (channel === null) {
      stableVersions.add(version);
    } else {
      const versions = prereleaseVersionsByChannel.get(channel) ?? new Set();
      versions.add(version);
      prereleaseVersionsByChannel.set(channel, versions);
    }
  }

  const keepStable = [...stableVersions].sort(compareVersionDesc).slice(0, KEEP);
  const keepPrereleaseByChannel = new Map();
  for (const [channel, versions] of prereleaseVersionsByChannel) {
    keepPrereleaseByChannel.set(
      channel,
      [...versions].sort(compareVersionDesc).slice(0, KEEP_PRERELEASE)
    );
  }
  const keepSet = new Set([
    ...keepStable,
    ...[...keepPrereleaseByChannel.values()].flat(),
  ]);

  const toDelete = versioned.filter((o) => !keepSet.has(o.version) && !protectedKeys.has(o.key));
  const freedBytes = toDelete.reduce((sum, o) => sum + o.size, 0);

  console.log(`Stable versions: [${[...stableVersions].sort(compareVersionDesc).join(', ')}]`);
  for (const [channel, versions] of [...prereleaseVersionsByChannel.entries()].sort()) {
    console.log(`Prerelease ${channel} versions: [${[...versions].sort(compareVersionDesc).join(', ')}]`);
  }
  console.log(`Keeping ${keepStable.length} stable: [${keepStable.join(', ')}]`);
  for (const [channel, versions] of [...keepPrereleaseByChannel.entries()].sort()) {
    console.log(`Keeping ${versions.length} ${channel}: [${versions.join(', ')}]`);
  }
  console.log(`Protected by live manifests: ${protectedKeys.size} object(s)`);
  console.log(`${DRY_RUN ? 'Would delete' : 'Deleting'} ${toDelete.length} object(s) (${humanSize(freedBytes)})`);

  if (toDelete.length === 0) {
    console.log('Nothing to prune.');
    return;
  }

  if (DRY_RUN) {
    for (const object of toDelete) {
      console.log(`[dry-run] ${object.key}`);
    }
    return;
  }

  const tmp = mkdtempSync(join(tmpdir(), 'r2-prune-'));
  let deleted = 0;
  let failed = 0;
  let freed = 0;
  for (let i = 0; i < toDelete.length; i += 1000) {
    const batch = toDelete.slice(i, i + 1000);
    const payload = { Objects: batch.map((o) => ({ Key: o.key })), Quiet: true };
    const file = join(tmp, `batch-${i}.json`);
    writeFileSync(file, JSON.stringify(payload));
    const out = aws([
      's3api',
      'delete-objects',
      '--bucket',
      BUCKET,
      '--endpoint-url',
      ENDPOINT,
      '--delete',
      `file://${file}`,
      '--output',
      'json',
    ]);
    // Quiet mode returns no success list but still reports per-key Errors with a
    // 200 status (exit 0), so partial failures are invisible unless parsed.
    const result = out.trim() ? JSON.parse(out) : {};
    const errors = Array.isArray(result.Errors) ? result.Errors : [];
    const failedKeys = new Set(errors.map((e) => e.Key));
    for (const error of errors) {
      console.error(`[warn] failed to delete ${error.Key}: ${error.Code} ${error.Message}`);
    }
    for (const object of batch) {
      if (!failedKeys.has(object.key)) {
        freed += object.size;
      }
    }
    deleted += batch.length - failedKeys.size;
    failed += failedKeys.size;
    console.log(`Deleted ${batch.length - failedKeys.size}/${batch.length} object(s) in batch`);
  }

  console.log(`Pruned ${deleted} object(s), freed ${humanSize(freed)}.`);
  if (failed > 0) {
    console.error(`[warn] ${failed} object(s) failed to delete; re-run to retry`);
    process.exitCode = 1;
  }
}

main();
