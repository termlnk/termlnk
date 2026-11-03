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
 * TEMPORARY: remove this module (and its controller, test and the
 * `legacyAgentHookCleanupDone` config field) once users have migrated off
 * releases that installed external agent hooks (one or two releases after
 * the hook system was removed).
 *
 * Earlier versions rewrote third-party agent configs (Claude Code, Codex,
 * Cursor, Gemini, Copilot, CodeBuddy, OpenCode, Kimi) to call a Termlnk
 * launcher. Every entry carried the marker below. This strips exactly those
 * entries and leaves everything else untouched.
 */

import type { ILogService } from '@termlnk/core';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, renameSync, rmdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Substring that identified every hook entry written by Termlnk. */
const LEGACY_HOOK_MARKER = 'TERMLNK_HOOK';

const KIMI_BLOCK_PATTERN = /# === TERMLNK_HOOK_BEGIN ===[\s\S]*?# === TERMLNK_HOOK_END ===/;

type LegacyHookFormat = 'flat' | 'nested';

interface ILegacyJsonTarget {
  agent: string;
  /** Path segments relative to the home directory. */
  dir: string[];
  /** Environment variable that replaced `dir` with an absolute directory. */
  dirEnvOverride?: string;
  file: string;
  format: LegacyHookFormat;
}

// Same locations and formats the removed adapters wrote to.
const JSON_TARGETS: readonly ILegacyJsonTarget[] = [
  { agent: 'claude-code', dir: ['.claude'], file: 'settings.json', format: 'nested' },
  { agent: 'codex', dir: ['.codex'], dirEnvOverride: 'CODEX_HOME', file: 'hooks.json', format: 'nested' },
  { agent: 'cursor', dir: ['.cursor'], file: 'hooks.json', format: 'flat' },
  { agent: 'gemini', dir: ['.gemini'], file: 'settings.json', format: 'nested' },
  { agent: 'copilot', dir: ['.copilot'], file: 'config.json', format: 'nested' },
  { agent: 'codebuddy', dir: ['.codebuddy'], file: 'settings.json', format: 'nested' },
];

export interface ILegacyAgentHookCleanupOptions {
  homeDir: string;
  /** Termlnk config root that held `bin/` launcher files and `runtime.json`. */
  configPath?: string;
  env?: Record<string, string | undefined>;
  logService: ILogService;
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasMarker(command: unknown): boolean {
  return typeof command === 'string' && command.includes(LEGACY_HOOK_MARKER);
}

/**
 * Removes marked entries from a parsed `hooks` object in place.
 * Returns true when anything was removed.
 */
function stripJsonHooks(hooks: JsonObject, format: LegacyHookFormat): boolean {
  let changed = false;

  for (const [event, value] of Object.entries(hooks)) {
    if (!Array.isArray(value)) {
      continue;
    }

    const kept: unknown[] = [];
    let eventChanged = false;
    for (const entry of value) {
      if (!isObject(entry)) {
        kept.push(entry);
        continue;
      }

      if (format === 'flat') {
        if (hasMarker(entry.command)) {
          eventChanged = true;
          continue;
        }
        kept.push(entry);
        continue;
      }

      const list = entry.hooks;
      if (!Array.isArray(list)) {
        kept.push(entry);
        continue;
      }
      const remaining = list.filter((hook) => !(isObject(hook) && hasMarker(hook.command)));
      if (remaining.length === list.length) {
        kept.push(entry);
        continue;
      }
      eventChanged = true;
      if (remaining.length > 0) {
        kept.push({ ...entry, hooks: remaining });
      }
    }

    if (!eventChanged) {
      continue;
    }
    changed = true;
    if (kept.length === 0) {
      delete hooks[event];
    } else {
      hooks[event] = kept;
    }
  }

  return changed;
}

function detectIndent(raw: string): string | number {
  const match = /^[ \t]+(?=")/m.exec(raw);
  return match ? match[0] : 2;
}

/** Writes via a sibling temp file and rename; follows symlinks and keeps the file mode. */
function writeAtomic(filePath: string, content: string): void {
  const target = realpathSync(filePath);
  const mode = statSync(target).mode & 0o777;
  const tmp = join(dirname(target), `.${randomBytes(6).toString('hex')}.termlnk-tmp`);
  try {
    writeFileSync(tmp, content, { mode });
    renameSync(tmp, target);
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
      // Temp file may not exist.
    }
    throw err;
  }
}

function cleanJsonTarget(target: ILegacyJsonTarget, options: ILegacyAgentHookCleanupOptions): void {
  const override = target.dirEnvOverride ? options.env?.[target.dirEnvOverride] : undefined;
  const dir = override || join(options.homeDir, ...target.dir);
  const filePath = join(dir, target.file);
  if (!existsSync(filePath)) {
    return;
  }

  const raw = readFileSync(filePath, 'utf-8');
  const parsed: unknown = JSON.parse(raw);
  if (!isObject(parsed) || !isObject(parsed.hooks)) {
    return;
  }

  if (!stripJsonHooks(parsed.hooks, target.format)) {
    return;
  }
  if (Object.keys(parsed.hooks).length === 0) {
    delete parsed.hooks;
  }

  const trailing = raw.endsWith('\n') ? '\n' : '';
  writeAtomic(filePath, `${JSON.stringify(parsed, null, detectIndent(raw))}${trailing}`);
  options.logService.log('[LegacyAgentHookCleanup]', `Removed ${target.agent} hooks from ${filePath}`);
}

/** Exported for tests. Removes the marked Kimi TOML block, keeping surrounding text. */
export function stripKimiHookBlock(content: string): string | null {
  const match = KIMI_BLOCK_PATTERN.exec(content);
  if (!match) {
    return null;
  }
  const before = content.slice(0, match.index).replace(/\n+$/, '');
  const after = content.slice(match.index + match[0].length).replace(/^\n+/, '');
  if (!before && !after) {
    return '';
  }
  if (!after) {
    return `${before}\n`;
  }
  return before ? `${before}\n\n${after}` : after;
}

function cleanKimi(options: ILegacyAgentHookCleanupOptions): void {
  const filePath = join(options.homeDir, '.kimi', 'config.toml');
  if (!existsSync(filePath)) {
    return;
  }
  const cleaned = stripKimiHookBlock(readFileSync(filePath, 'utf-8'));
  if (cleaned === null) {
    return;
  }
  writeAtomic(filePath, cleaned);
  options.logService.log('[LegacyAgentHookCleanup]', `Removed kimi-code hooks from ${filePath}`);
}

function cleanOpenCode(options: ILegacyAgentHookCleanupOptions): void {
  const filePath = join(options.homeDir, '.config', 'opencode', 'plugins', 'termlnk-hooks.mjs');
  if (!existsSync(filePath)) {
    return;
  }
  // The plugin was generated with the marker in its header; leave any file without it alone.
  if (!readFileSync(filePath, 'utf-8').includes(LEGACY_HOOK_MARKER)) {
    return;
  }
  unlinkSync(filePath);
  options.logService.log('[LegacyAgentHookCleanup]', `Removed opencode hook plugin ${filePath}`);
}

function removeFile(filePath: string, options: ILegacyAgentHookCleanupOptions): void {
  if (!existsSync(filePath)) {
    return;
  }
  unlinkSync(filePath);
  options.logService.log('[LegacyAgentHookCleanup]', `Removed ${filePath}`);
}

function cleanLauncherFiles(options: ILegacyAgentHookCleanupOptions): void {
  // The Claude Code wrapper lived under the desktop config dir regardless of `configPath`.
  removeFile(join(options.homeDir, '.config', 'termlnk', 'bin', 'claude'), options);

  if (!options.configPath) {
    return;
  }
  const binDir = join(options.configPath, 'bin');
  for (const name of ['termlnk-hook', 'termlnk-hook.cmd', 'hook-helper.js']) {
    removeFile(join(binDir, name), options);
  }
  removeFile(join(options.configPath, 'runtime.json'), options);
}

function removeEmptyDirs(options: ILegacyAgentHookCleanupOptions): void {
  const dirs = [
    join(options.homeDir, '.config', 'termlnk', 'bin'),
    ...(options.configPath ? [join(options.configPath, 'bin')] : []),
  ];
  for (const dir of dirs) {
    try {
      rmdirSync(dir);
    } catch {
      // Not empty or missing: leave it.
    }
  }
}

/**
 * Runs every step independently; a failure in one never blocks the others and never throws.
 * Returns false when any step failed so the caller retries on the next launch
 * (every step is idempotent, and a leftover hook breaks the user's agent on each event).
 */
export function cleanupLegacyAgentHooks(options: ILegacyAgentHookCleanupOptions): boolean {
  const steps: Array<[string, () => void]> = [
    ...JSON_TARGETS.map((target): [string, () => void] => [target.agent, () => cleanJsonTarget(target, options)]),
    ['kimi-code', () => cleanKimi(options)],
    ['opencode', () => cleanOpenCode(options)],
    ['launcher', () => cleanLauncherFiles(options)],
  ];

  let succeeded = true;
  for (const [name, step] of steps) {
    try {
      step();
    } catch (err) {
      succeeded = false;
      options.logService.warn('[LegacyAgentHookCleanup]', `Skipped ${name}:`, err);
    }
  }

  removeEmptyDirs(options);
  return succeeded;
}
