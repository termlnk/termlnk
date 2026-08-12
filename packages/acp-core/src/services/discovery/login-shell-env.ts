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

import { execFile } from 'node:child_process';
import process from 'node:process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ANSI_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

let cachedEnv: Record<string, string> | null = null;
let resolvePromise: Promise<Record<string, string>> | null = null;

/**
 * GUI-launched apps on macOS inherit launchd's minimal PATH, not the user's
 * shell PATH, so agents installed via nvm/homebrew/cargo are invisible to a
 * naive PATH probe. Resolve the login shell's environment once and reuse it
 * for every probe and every agent spawn.
 *
 * Desktop bootstrap already patches process.env.PATH via fixProcessPath();
 * this goes further and returns the full env map so agent children inherit
 * the same nvm/cargo/homebrew variables the user sees in a terminal.
 */
export async function resolveLoginShellEnv(): Promise<Record<string, string>> {
  if (cachedEnv) {
    return cachedEnv;
  }
  if (resolvePromise) {
    return resolvePromise;
  }

  resolvePromise = doResolve().then((env) => {
    cachedEnv = env;
    return env;
  });
  return resolvePromise;
}

/** Test-only: clear the process-lifetime cache. */
export function _resetLoginShellEnvCacheForTests(): void {
  cachedEnv = null;
  resolvePromise = null;
}

async function doResolve(): Promise<Record<string, string>> {
  if (process.platform === 'win32') {
    return { ...process.env } as Record<string, string>;
  }

  const shell = process.env.SHELL || '/bin/zsh';
  try {
    // `command env` avoids shell aliases for `env`. NUL-safe enough for PATH/HOME/etc.
    const { stdout } = await execFileAsync(shell, ['-ilc', 'command env -0'], {
      encoding: 'buffer',
      timeout: 5000,
      maxBuffer: 2 * 1024 * 1024,
      env: process.env,
    });

    const text = stdout.toString('utf8').replace(ANSI_RE, '');
    const env: Record<string, string> = {};
    for (const entry of text.split('\0')) {
      if (!entry) {
        continue;
      }
      const eq = entry.indexOf('=');
      if (eq <= 0) {
        continue;
      }
      env[entry.slice(0, eq)] = entry.slice(eq + 1);
    }

    if (Object.keys(env).length === 0) {
      return { ...process.env } as Record<string, string>;
    }

    // Always prefer the current process's Electron-specific vars over shell ones.
    return {
      ...env,
      ...pickElectronEnv(process.env),
    };
  } catch {
    return { ...process.env } as Record<string, string>;
  }
}

function pickElectronEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const keys = [
    'ELECTRON_RUN_AS_NODE',
    'ELECTRON_NO_ATTACH_CONSOLE',
    'ORIGINAL_XDG_CURRENT_DESKTOP',
  ] as const;
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = env[key];
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}
