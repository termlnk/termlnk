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

import type { IActiveSessionContext, IPlatformContext, IPlatformContextService, ITerminalSessionEnvService, PlatformType, ShellType } from '@termlnk/agent';
import type { ILogService } from '@termlnk/core';
import type { ITerminalSessionNotifyService } from '@termlnk/rpc';
import type { Observable } from 'rxjs';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { arch, homedir, release } from 'node:os';
import { basename } from 'node:path';
import process from 'node:process';
import { ITerminalSessionEnvService as ITerminalSessionEnvServiceId } from '@termlnk/agent';
import { Disposable, ILogService as ILogServiceId, Inject, Injector, isLinux, isMacintosh, isWindows, LocaleService, LocaleType, platform, PlatformToString } from '@termlnk/core';
import { ITerminalSessionNotifyService as ITerminalSessionNotifyServiceId } from '@termlnk/rpc';
import { BehaviorSubject, debounceTime, Subject } from 'rxjs';

export const DEFAULT_CONTEXT: IPlatformContext = {
  platform: PlatformToString(platform),
  arch: arch(),
  defaultShell: 'unknown',
  osVersion: 'unknown',
  homeDir: homedir(),
  currentDate: new Date().toISOString().split('T')[0],
  locale: LocaleType.EN_US,
  activeSessions: [],
  focusedSession: null,
};

export class PlatformContextService extends Disposable implements IPlatformContextService {
  private readonly _context$ = new BehaviorSubject<IPlatformContext>(DEFAULT_CONTEXT);
  readonly context$: Observable<IPlatformContext> = this._context$.asObservable();

  private readonly _refreshTrigger$ = new Subject<void>();
  private _cachedOsVersion: string | null = null;

  private readonly _sessions = new Map<string, IActiveSessionContext>();
  private _focusedSessionId: string | null = null;

  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @ILogServiceId private readonly _logService: ILogService,
    @Inject(LocaleService) private readonly _localeService: LocaleService,
    @ITerminalSessionNotifyServiceId private readonly _sessionNotify: ITerminalSessionNotifyService,
    @ITerminalSessionEnvServiceId private readonly _sessionEnv: ITerminalSessionEnvService
  ) {
    super();

    this._init();
  }

  private _init() {
    this.disposeWithMe(
      this._refreshTrigger$.pipe(debounceTime(500)).subscribe(() => {
        this._context$.next(this._buildContext());
      })
    );

    this.disposeWithMe(
      this._localeService.localeChanged$.subscribe(() => {
        this._refreshTrigger$.next();
      })
    );

    this.disposeWithMe(
      this._sessionNotify.sessionCreated$.subscribe((event) => {
        const initialEnv = this._sessionEnv.getEnv(event.sessionId);
        this._sessions.set(event.sessionId, {
          sessionId: event.sessionId,
          type: event.type,
          shell: initialEnv.remoteShell ?? 'unknown',
          cwd: '',
          isAtPrompt: false,
          hostLabel: event.hostLabel,
          ...initialEnv,
        });
        this._refreshTrigger$.next();
      })
    );

    this.disposeWithMe(
      this._sessionNotify.sessionClosed$.subscribe((event) => {
        this._sessions.delete(event.sessionId);
        if (this._focusedSessionId === event.sessionId) {
          this._focusedSessionId = null;
        }
        this._refreshTrigger$.next();
      })
    );

    this.disposeWithMe(
      this._sessionNotify.focusedSessionId$.subscribe((id) => {
        this._focusedSessionId = id;
        this._refreshTrigger$.next();
      })
    );

    this.disposeWithMe(
      this._sessionEnv.env$.subscribe((change) => {
        const ctx = this._sessions.get(change.sessionId);
        if (!ctx) {
          return;
        }
        Object.assign(ctx, change.env);
        if (change.env.remoteShell) {
          ctx.shell = change.env.remoteShell;
        }
        this._refreshTrigger$.next();
      })
    );

    this._context$.next(this._buildContext());
  }

  getContext(): IPlatformContext {
    return this._context$.getValue();
  }

  private _buildContext(): IPlatformContext {
    const activeSessions = Array.from(this._sessions.values());
    const focusedSession = this._focusedSessionId
      ? this._sessions.get(this._focusedSessionId) ?? null
      : null;

    return {
      platform: this._detectEffectivePlatform(focusedSession),
      arch: arch(),
      defaultShell: this._detectDefaultShell(),
      osVersion: this._detectOsVersion(),
      homeDir: homedir(),
      currentDate: new Date().toISOString().split('T')[0],
      locale: this._localeService?.getCurrentLocale() ?? '',
      activeSessions,
      focusedSession,
    };
  }

  /**
   * The OS where the AI's next command will run. A focused session's reported
   * remote OS wins over the local one — otherwise SSH suggestions would use
   * the wrong package manager / binaries when the remote OS differs.
   */
  private _detectEffectivePlatform(focused: IActiveSessionContext | null): PlatformType {
    if (focused?.remoteOS && focused.remoteOS !== 'unknown') {
      return focused.remoteOS;
    }
    return this._detectPlatform();
  }

  private _detectPlatform(): PlatformType {
    if (isMacintosh) {
      return 'macos';
    }
    if (isWindows) {
      return 'windows';
    }
    if (isLinux) {
      if (process.env.WSL_DISTRO_NAME) {
        return 'wsl';
      }
      const procVersion = readFileSync('/proc/version', 'utf-8');
      if (/microsoft|wsl/i.test(procVersion)) {
        return 'wsl';
      }
      return 'linux';
    }
    return 'unknown';
  }

  private _detectDefaultShell(): ShellType {
    if (isWindows) {
      return this._parseShellType(process.env.COMSPEC ?? 'cmd.exe');
    }
    return this._parseShellType(process.env.SHELL ?? '/bin/sh');
  }

  private _parseShellType(shellPath: string): ShellType {
    const name = basename(shellPath).replace(/\.exe$/i, '').toLowerCase();
    const shellMap: Record<string, ShellType> = {
      bash: 'bash',
      zsh: 'zsh',
      fish: 'fish',
      powershell: 'powershell',
      pwsh: 'pwsh',
      cmd: 'cmd',
      sh: 'sh',
    };
    return shellMap[name] ?? 'unknown';
  }

  private _detectOsVersion(): string {
    if (this._cachedOsVersion !== null) {
      return this._cachedOsVersion;
    }
    try {
      if (isMacintosh) {
        this._cachedOsVersion = execSync('sw_vers -productName && sw_vers -productVersion', {
          encoding: 'utf-8',
          timeout: 3000,
        }).trim().replace('\n', ' ');
      } else if (isLinux) {
        try {
          const osRelease = readFileSync('/etc/os-release', 'utf-8');
          const prettyName = osRelease.match(/PRETTY_NAME="?([^"\n]+)"?/)?.[1];
          this._cachedOsVersion = prettyName ?? `Linux ${release()}`;
        } catch {
          this._cachedOsVersion = `Linux ${release()}`;
        }
      } else {
        this._cachedOsVersion = `Windows ${release()}`;
      }
    } catch {
      this._cachedOsVersion = release();
    }
    return this._cachedOsVersion;
  }

  override dispose(): void {
    this._sessions.clear();
    this._context$.complete();
    this._refreshTrigger$.complete();
    super.dispose();
  }
}
