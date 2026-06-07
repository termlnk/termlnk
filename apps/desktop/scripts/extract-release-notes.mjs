import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const require = createRequire(import.meta.url);
const { extractLog } = require('extract-changelog-release');

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '../../..');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const { values: args } = parseArgs({
  options: {
    changelog: { type: 'string', default: 'docs/CHANGELOG.md' },
    out: { type: 'string', default: 'apps/desktop/build/release-notes.md' },
    version: { type: 'string' },
  },
});

const changelogPath = resolve(REPO_ROOT, args.changelog);
const outputPath = resolve(REPO_ROOT, args.out);
const releaseNotes = extractLog(changelogPath);

if (!releaseNotes) {
  throw new Error(`No release notes extracted from ${changelogPath}.`);
}

if (args.version) {
  const firstLine = releaseNotes.split(/\r?\n/, 1)[0] ?? '';
  const expectedHeading = new RegExp(`^#+\\s+(?:\\[)?${escapeRegExp(args.version)}(?:\\])?(?:\\s|\\(|$)`);

  if (!expectedHeading.test(firstLine)) {
    throw new Error(`Extracted release notes for "${firstLine}", expected version ${args.version}.`);
  }
}

await writeFile(outputPath, `${releaseNotes}\n`, 'utf8');
