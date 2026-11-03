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

import type { ACPProviderAvailability } from '@termlnk/acp';
import { execFile } from 'node:child_process';
import { accessSync, constants as fsConstants } from 'node:fs';
import { delimiter, isAbsolute, join } from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { DEFAULT_PROBE_TIMEOUT_MS } from '@termlnk/acp';

const execFileAsync = promisify(execFile);

const ON_DEMAND_LAUNCHERS = new Set(['npx', 'bunx', 'pnpx', 'yarn', 'pnpm', 'deno']);

export function isOnDemandLauncher(binary: string): boolean {
  const base = binary.replace(/\.cmd$/i, '').replace(/\.exe$/i, '');
  return ON_DEMAND_LAUNCHERS.has(base);
}

/**
 * Resolve a binary against PATH (and PATHEXT on Windows). Returns the absolute
 * path when found, otherwise null.
 */
export function resolveBinaryOnPath(
  binary: string,
  env: Record<string, string>
): string | null {
  if (isAbsolute(binary) || binary.includes('/') || binary.includes('\\')) {
    return isExecutable(binary) ? binary : null;
  }

  const pathValue = env.PATH || env.Path || '';
  const dirs = pathValue.split(delimiter).filter(Boolean);
  const candidates = buildCandidates(binary, env);

  for (const dir of dirs) {
    for (const name of candidates) {
      const full = join(dir, name);
      if (isExecutable(full)) {
        return full;
      }
    }
  }
  return null;
}

export async function probeProviderAvailability(
  command: readonly [string, ...string[]],
  env: Record<string, string>,
  options: { probeTimeoutMs?: number } = {}
): Promise<ACPProviderAvailability> {
  const binary = command[0];
  if (isOnDemandLauncher(binary)) {
    const launcher = resolveBinaryOnPath(binary, env);
    return launcher ? { state: 'on-demand' } : { state: 'missing' };
  }

  const resolvedPath = resolveBinaryOnPath(binary, env);
  if (!resolvedPath) {
    return { state: 'missing' };
  }

  const version = await tryReadVersion(
    resolvedPath,
    env,
    options.probeTimeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS
  );
  return version
    ? { state: 'installed', resolvedPath, version }
    : { state: 'installed', resolvedPath };
}

function buildCandidates(binary: string, env: Record<string, string>): string[] {
  if (process.platform !== 'win32') {
    return [binary];
  }
  if (/\.[a-z0-9]+$/i.test(binary)) {
    return [binary];
  }
  const pathext = (env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean);
  return [binary, ...pathext.map((ext) => binary + ext.toLowerCase()), ...pathext.map((ext) => binary + ext)];
}

function isExecutable(path: string): boolean {
  try {
    accessSync(path, fsConstants.X_OK);
    return true;
  } catch {
    try {
      // On Windows X_OK is not meaningful; F_OK is enough.
      accessSync(path, fsConstants.F_OK);
      return process.platform === 'win32';
    } catch {
      return false;
    }
  }
}

async function tryReadVersion(
  binaryPath: string,
  env: Record<string, string>,
  timeoutMs: number
): Promise<string | undefined> {
  try {
    const { stdout, stderr } = await execFileAsync(binaryPath, ['--version'], {
      encoding: 'utf8',
      timeout: timeoutMs,
      env,
      windowsHide: true,
    });
    const text = (stdout || stderr || '').trim().split('\n')[0]?.trim();
    return text || undefined;
  } catch {
    return undefined;
  }
}
