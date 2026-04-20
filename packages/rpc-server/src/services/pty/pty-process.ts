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

import type { IDisposable } from '@termlnk/core';
import type { IPty } from 'node-pty';
import type { Observable } from 'rxjs';
import { Buffer } from 'node:buffer';
import { existsSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as process from 'node:process';
import { DisposableCollection, Platform, platform, toDisposable } from '@termlnk/core';
import { spawn } from 'node-pty';
import { share, Subject } from 'rxjs';
import { applyEnvOverrides, BASH_INJECTION_DELAY_MS, prepareShellIntegration, restoreEnvOverrides } from './shell-integration';

export interface IPTYSpawnOptions {
  cols?: number;
  rows?: number;
  cwd?: string;
  shell?: string;
  /** PTY session ID to inject as TERMLNK_SESSION_ID environment variable */
  sessionId?: string;
  /** Application config root directory for shell integration scripts */
  configPath?: string;
  /** When true on Windows, spawn ConPTY with PSEUDOCONSOLE_INHERIT_CURSOR so the initial output does not clear the pre-written scrollback. */
  restored?: boolean;
}

export interface IPTYExitEvent {
  exitCode: number;
  signal?: number;
}

export interface IPTYProcess extends IDisposable {
  readonly pid: number;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
  data$: Observable<Buffer>;
  exit$: Observable<IPTYExitEvent>;
}

function stripWrappingQuotes(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }

  return value;
}

export function getDefaultShell(currentPlatform: Platform = platform, env: NodeJS.ProcessEnv = process.env): string {
  if (currentPlatform === Platform.Windows) {
    return stripWrappingQuotes(env.COMSPEC || 'cmd.exe');
  }

  // 1. os.userInfo().shell calls getpwuid() under the hood,
  //    which reads Directory Services on macOS and /etc/passwd (or NSS) on Linux.
  try {
    const { shell } = os.userInfo();
    if (shell) {
      return shell;
    }
  } catch {
    // userInfo() can throw in sandboxed/container environments
  }

  // 2. Fall back to $SHELL env var
  if (env.SHELL && env.SHELL !== '/bin/false') {
    return env.SHELL;
  }

  // 3. Platform defaults
  if (currentPlatform === Platform.Mac) {
    return '/bin/zsh';
  }

  return '/bin/sh';
}

export function getDefaultShellArgs(shell: string, currentPlatform: Platform = platform): string[] {
  if (currentPlatform === Platform.Windows) {
    const shellName = path.win32.basename(shell).toLowerCase();
    if (shellName === 'cmd.exe' || shellName === 'cmd') {
      return ['/d'];
    }

    return [];
  }

  const shellName = path.basename(shell);

  // Login shell flag for common POSIX shells
  if (['bash', 'zsh', 'fish', 'ksh', 'dash', 'ash'].includes(shellName)) {
    return ['--login'];
  }

  // tcsh/csh use -l (no long form)
  if (['tcsh', 'csh'].includes(shellName)) {
    return ['-l'];
  }

  // nushell / elvish / xonsh: login flag via --login
  if (['nu', 'elvish', 'xonsh'].includes(shellName)) {
    return ['--login'];
  }

  return [];
}

function getDefaultCwd(cwd?: string): string {
  if (cwd && existsSync(cwd)) {
    return cwd;
  }
  return os.homedir();
}

export interface IPTYProcessResult {
  process: IPTYProcess;
  shellPath: string;
}

export function createPTYProcess(options: IPTYSpawnOptions = {}): IPTYProcessResult {
  const disposables = new DisposableCollection();

  const shell = options.shell || getDefaultShell();
  const args = getDefaultShellArgs(shell);
  const cols = Math.max(options.cols ?? 80, 1);
  const rows = Math.max(options.rows ?? 24, 1);
  const cwd = getDefaultCwd(options.cwd);

  // Set terminal-related env vars directly on process.env
  // instead of building a custom env object (which can cause posix_spawnp failures)
  process.env.COLORTERM = 'truecolor';
  process.env.TERM = 'xterm-256color';
  process.env.TERM_PROGRAM = 'termlnk';
  process.env.TERM_PROGRAM_VERSION = '0.0.0';

  if (platform === Platform.Mac && !process.env.LC_ALL) {
    const locale = process.env.LC_CTYPE || 'en_US.UTF-8';
    process.env.LANG = locale;
    process.env.LC_ALL = locale;
  }

  // Set up shell integration (file writing + env/args setup)
  const shellName = path.basename(shell);
  const siSetup = options.configPath ? prepareShellIntegration(shellName, options.configPath) : null;

  if (siSetup) {
    args.push(...siSetup.extraArgs);
    applyEnvOverrides(siSetup);
  }

  // Inject TERMLNK_SESSION_ID for agent hook correlation
  const savedSessionId = process.env.TERMLNK_SESSION_ID;
  if (options.sessionId) {
    process.env.TERMLNK_SESSION_ID = options.sessionId;
  }

  const pty: IPty = spawn(shell, args, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    encoding: null,
    // Windows-only: inherit cursor position on revive so ConPTY does not
    // issue a clear+home that wipes the restored scrollback. Ignored by
    // node-pty on non-Windows platforms.
    conptyInheritCursor: options.restored === true,
  });

  // Restore env vars after spawn (child process already captured them at fork time)
  if (siSetup) {
    restoreEnvOverrides(siSetup);
  }
  if (options.sessionId) {
    if (savedSessionId !== undefined) {
      process.env.TERMLNK_SESSION_ID = savedSessionId;
    } else {
      delete process.env.TERMLNK_SESSION_ID;
    }
  }

  const dataSubject = new Subject<Buffer>();
  const exitSubject = new Subject<IPTYExitEvent>();

  const dataDisposable = pty.onData((data) => {
    // node-pty types onData as string. With encoding: null, macOS/Linux
    // return Buffer at runtime, but Windows ConPTY still returns string.
    // Normalize to Buffer at the boundary so downstream code can rely on it.
    dataSubject.next(typeof data === 'string' ? Buffer.from(data) : (data as unknown as Buffer));
  });
  disposables.add(toDisposable(() => dataDisposable.dispose()));

  const exitDisposable = pty.onExit(({ exitCode, signal }) => {
    exitSubject.next({ exitCode, signal });
    exitSubject.complete();
  });
  disposables.add(toDisposable(() => exitDisposable.dispose()));

  disposables.add(toDisposable(() => {
    dataSubject.complete();
  }));

  // For bash: inject via single-line source command after shell initializes
  if (siSetup?.postSpawnInjection) {
    const scriptPath = siSetup.postSpawnInjection;
    setTimeout(() => {
      pty.write(` source "${scriptPath}" 2>/dev/null\r`);
    }, BASH_INJECTION_DELAY_MS);
  }

  const ptyProcess: IPTYProcess = {
    get pid() {
      return pty.pid;
    },

    write(data: string) {
      pty.write(data);
    },

    resize(newCols: number, newRows: number) {
      pty.resize(newCols, newRows);
    },

    kill(signal?: string) {
      pty.kill(signal);
    },

    data$: dataSubject.asObservable().pipe(share()),
    exit$: exitSubject.asObservable().pipe(share()),

    dispose() {
      disposables.dispose();
    },
  };

  return { process: ptyProcess, shellPath: shell };
}
