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

import type { IACPSessionInfo } from '@termlnk/acp';
import type { Nullable } from '@termlnk/core';
import type { IProjectContext, IProjectContextService, IProjectCwdChange, IProjectCwdService, IProjectFsService } from '@termlnk/project';
import type { ITerminalSession } from '@termlnk/terminal-ui';
import type { Observable } from 'rxjs';
import { ACP_SESSION_TYPE, IACPSessionService } from '@termlnk/acp';
import { Disposable } from '@termlnk/core';
import { IProjectCwdService as IProjectCwdServiceId, IProjectFsService as IProjectFsServiceId } from '@termlnk/project';
import { ISSHService } from '@termlnk/rpc-client';
import { IPTYService } from '@termlnk/terminal';
import { ITerminalUIService } from '@termlnk/terminal-ui';
import { BehaviorSubject, combineLatest, merge, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, map, share, shareReplay, switchMap, tap } from 'rxjs/operators';

/**
 * Derives project context from the active terminal/ACP tab.
 * Pinning freezes the context so panels don't flip on tab switches.
 */
export class ProjectContextService extends Disposable implements IProjectContextService {
  private readonly _pinned$ = new BehaviorSubject<Nullable<IProjectContext>>(null);
  private _latest: Nullable<IProjectContext> = null;

  /**
   * Lazily wired and reference-counted: the remote git/fs probes only run while
   * a panel is actually subscribed. An eagerly wired BehaviorSubject would keep
   * probing SSH for every open session forever.
   */
  readonly activeContext$: Observable<Nullable<IProjectContext>>;

  constructor(
    @ITerminalUIService private readonly _terminalUI: ITerminalUIService,
    @IProjectFsServiceId private readonly _fs: IProjectFsService,
    @IACPSessionService private readonly _acpSessions: IACPSessionService,
    @IProjectCwdServiceId private readonly _cwdSignal: IProjectCwdService,
    @IPTYService private readonly _pty: IPTYService,
    @ISSHService private readonly _ssh: ISSHService
  ) {
    super();
    this.activeContext$ = this._buildActiveContext$();
  }

  get activeContext(): Nullable<IProjectContext> {
    return this._latest;
  }

  pinContext(context: IProjectContext | null): void {
    this._pinned$.next(context);
  }

  override dispose(): void {
    super.dispose();
    this._pinned$.complete();
  }

  private _buildActiveContext$(): Observable<Nullable<IProjectContext>> {
    // One IPC subscription for the whole service. Resubscribing inside the
    // switchMap below would tear down and rebuild it on every tab switch.
    const cwdChanged$ = this._cwdSignal.cwdChanged$.pipe(share());

    const derived$ = combineLatest([
      this._terminalUI.activeSessionId$,
      this._terminalUI.sessions$,
      this._acpSessions.sessions$,
    ]).pipe(
      // Re-derive when the tab changes, and again whenever the shell reports a
      // `cd` in that tab. switchMap cancels a superseded derivation.
      switchMap(([activeId, sessions, acpSessions]) =>
        this._cwdRefresh$(cwdChanged$, activeId).pipe(
          debounceTime(50),
          switchMap(() => this._deriveContext(activeId, sessions, acpSessions))
        )
      ),
      distinctUntilChanged(isSameContext)
    );

    return combineLatest([this._pinned$, derived$]).pipe(
      map(([pinned, derived]) => pinned ?? derived),
      tap((ctx) => {
        this._latest = ctx;
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  /** Fires once immediately, then on every `cd` reported for this session. */
  private _cwdRefresh$(
    cwdChanged$: Observable<IProjectCwdChange>,
    activeId: Nullable<string>
  ): Observable<unknown> {
    if (!activeId) {
      return of(null);
    }
    return merge(of(null), cwdChanged$.pipe(filter((e) => e.sessionId === activeId)));
  }

  private async _deriveContext(
    activeId: Nullable<string>,
    sessions: ITerminalSession[],
    acpSessions: IACPSessionInfo[]
  ): Promise<Nullable<IProjectContext>> {
    if (!activeId) {
      return null;
    }
    const session = sessions.find((s) => s.id === activeId);
    if (!session) {
      return null;
    }

    if (session.type === ACP_SESSION_TYPE) {
      const cwd = acpSessions.find((s) => s.id === activeId)?.cwd || '';
      return cwd ? this._localContext(activeId, cwd) : null;
    }

    if (session.type === 'local') {
      // Per-session cwd from shell integration — a global "last cwd" would
      // attribute the wrong directory whenever several terminals are open.
      const cwd = await this._pty.getCurrentCwd(activeId).catch(() => '');
      return cwd ? this._localContext(activeId, cwd) : null;
    }

    if (session.type === 'ssh' && session.hostId) {
      return this._remoteContext(activeId, session.hostId);
    }

    return null;
  }

  private async _localContext(sessionId: string, cwd: string): Promise<IProjectContext> {
    const seed: IProjectContext = {
      sessionId,
      scope: 'local',
      rootPath: cwd,
      cwd,
      isGitRepository: false,
    };
    const gitRoot = await this._fs.findGitRoot(seed, cwd);
    return {
      ...seed,
      rootPath: gitRoot || cwd,
      isGitRepository: !!gitRoot,
    };
  }

  private async _remoteContext(
    sessionId: string,
    hostId: string
  ): Promise<Nullable<IProjectContext>> {
    const remoteCwd = await this._ssh.getCurrentCwd(sessionId).catch(() => '');
    if (!remoteCwd) {
      // No cwd reported yet: every remote git/fs call would target an unknown
      // directory, so stay context-less instead of guessing '~'.
      return null;
    }

    const seed: IProjectContext = {
      sessionId,
      scope: 'remote',
      hostId,
      rootPath: remoteCwd,
      cwd: remoteCwd,
      isGitRepository: false,
    };

    const gitRoot = await this._fs.findGitRoot(seed, remoteCwd);
    return {
      ...seed,
      rootPath: gitRoot || remoteCwd,
      isGitRepository: !!gitRoot,
    };
  }
}

function isSameContext(a: Nullable<IProjectContext>, b: Nullable<IProjectContext>): boolean {
  return a?.sessionId === b?.sessionId
    && a?.cwd === b?.cwd
    && a?.rootPath === b?.rootPath
    && a?.scope === b?.scope
    && a?.hostId === b?.hostId
    && a?.isGitRepository === b?.isGitRepository;
}
