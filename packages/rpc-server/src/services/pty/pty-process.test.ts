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

import { Platform } from '@termlnk/core';
import { resolveTerminalIdentityEnv } from '@termlnk/terminal';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPTYProcess, getDefaultShell, getDefaultShellArgs } from './pty-process';

/**
 * Captures `process.env` as observed at spawn time — the child inherits the
 * parent env at fork, so that snapshot is what the shell actually sees.
 */
const envAtSpawn: Array<NodeJS.ProcessEnv> = [];

vi.mock('node-pty', () => ({
  spawn: () => {
    envAtSpawn.push({ ...process.env });
    return {
      pid: 1234,
      onData: () => ({ dispose: () => {} }),
      onExit: () => ({ dispose: () => {} }),
      write: () => {},
      resize: () => {},
      kill: () => {},
      pause: () => {},
      resume: () => {},
    };
  },
}));

function spawnAndReadEnv(identityEnv?: Record<string, string>): NodeJS.ProcessEnv {
  createPTYProcess(identityEnv ? { identityEnv } : {});
  const captured = envAtSpawn.at(-1);
  if (!captured) {
    throw new Error('spawn was not called');
  }
  return captured;
}

describe('getDefaultShell', () => {
  it('should strip wrapping quotes from COMSPEC on Windows', () => {
    expect(getDefaultShell(Platform.Windows, {
      COMSPEC: '\"C:\\Windows\\System32\\cmd.exe\"',
    })).toBe('C:\\Windows\\System32\\cmd.exe');
  });
});

describe('getDefaultShellArgs', () => {
  it('should disable AutoRun when launching Command Prompt on Windows', () => {
    expect(getDefaultShellArgs('C:\\Windows\\System32\\cmd.exe', Platform.Windows)).toEqual(['/d']);
  });

  it('should not add extra args for PowerShell on Windows', () => {
    expect(getDefaultShellArgs('C:\\Program Files\\PowerShell\\7\\pwsh.exe', Platform.Windows)).toEqual([]);
  });
});

describe('createPTYProcess terminal identity', () => {
  afterEach(() => {
    for (const key of ['TERM_PROGRAM', 'TERM_PROGRAM_VERSION', 'KITTY_WINDOW_ID', 'ITERM_SESSION_ID']) {
      delete process.env[key];
    }
    envAtSpawn.length = 0;
  });

  it('should announce termlnk when no identity is provided', () => {
    const env = spawnAndReadEnv();

    expect(env.TERM_PROGRAM).toBe('termlnk');
    expect(env.TERM_PROGRAM_VERSION).toBe('0.0.0');
    expect(env.TERM).toBe('xterm-256color');
    expect(env.COLORTERM).toBe('truecolor');
  });

  it('should announce the configured identity', () => {
    const env = spawnAndReadEnv(resolveTerminalIdentityEnv('ghostty'));

    expect(env.TERM_PROGRAM).toBe('ghostty');
    // TERM must stay put: a remote terminfo without xterm-ghostty would break.
    expect(env.TERM).toBe('xterm-256color');
  });

  it('should not leak markers from a previously spawned identity', () => {
    expect(spawnAndReadEnv(resolveTerminalIdentityEnv('kitty')).KITTY_WINDOW_ID).toBe('1');

    // process.env is process-wide, so switching back must clear the extra marker.
    const env = spawnAndReadEnv(resolveTerminalIdentityEnv('termlnk'));
    expect(env.TERM_PROGRAM).toBe('termlnk');
    expect(env.KITTY_WINDOW_ID).toBeUndefined();
  });

  it('should not leak the iTerm2 session id when switching to ghostty', () => {
    expect(spawnAndReadEnv(resolveTerminalIdentityEnv('iterm2')).ITERM_SESSION_ID).toBeDefined();

    expect(spawnAndReadEnv(resolveTerminalIdentityEnv('ghostty')).ITERM_SESSION_ID).toBeUndefined();
  });
});
