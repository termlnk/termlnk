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

import type { RemoteSessionEvent } from '@termlnk/shared-terminal';
import type { ITerminalSession } from '@termlnk/terminal-ui';
import type { Subscription } from 'rxjs';
import { ILogService, Inject, LocaleService, Optional, RxDisposable } from '@termlnk/core';
import { IRemoteSessionService, RemoteSessionStatus } from '@termlnk/shared-terminal';
import { ITerminalUIService, ITerminalViewRegistry } from '@termlnk/terminal-ui';
import { takeUntil } from 'rxjs';
import { RemoteTabAdornment } from '../views/RemoteTabAdornment';
import { RemoteTerminalView } from '../views/RemoteTerminalView';

export const REMOTE_SESSION_TYPE = 'remote';

/**
 * How long after `markUserInitiated(sid)` we still treat the sessionCreated$
 * arrival as user-initiated. Bigger than any realistic createSession round
 * trip so a slow relay handshake still gets the active-tab focus, but small
 * enough that a stale mark doesn't hijack focus minutes later when the same
 * sid happens to surface for a different reason.
 */
const USER_INITIATED_TTL_MS = 30_000;

/**
 * Bridges the joiner-side `IRemoteSessionService` with `ITerminalUIService` so
 * each successful join shows up as a `'remote'` tab and each disconnect/close
 * cleans up symmetrically.
 *
 * Wiring uses the symmetric `sessionCreated$` / `sessionClosed$` event streams
 * — sibling of the SSHService pattern in `agent-session-sync.controller`.
 * Failing tabs that the user closes call `closeSession`; the main process
 * tears down its session and re-emits `sessionClosed$`, which we react to.
 */
export class RemoteSessionBridgeController extends RxDisposable {
  /** Sessions we have created a tab for. */
  private readonly _ownedTabs = new Set<string>();
  /** Per-session subscription groups (status$, event$). */
  private readonly _perSessionSubs = new Map<string, Subscription[]>();
  /**
   * SessionIds the user explicitly chose to join via ParticipantJoinDialog.
   * Consulted by _addRemoteTab to decide whether to setActiveSession — that
   * way an automatic reattach (server-pushed, reconnect, or a second device)
   * does NOT steal focus from a tab the user is currently typing in.
   */
  private readonly _pendingUserInitiated = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    @ILogService private readonly _logService: ILogService,
    @ITerminalViewRegistry private readonly _viewRegistry: ITerminalViewRegistry,
    @ITerminalUIService private readonly _terminalUIService: ITerminalUIService,
    @Inject(LocaleService) private readonly _localeService: LocaleService,
    @Optional(IRemoteSessionService) private readonly _remote?: IRemoteSessionService
  ) {
    super();

    this._registerView();
    if (this._remote) {
      this._wireSessionLifecycle(this._remote);
      this._wireUserClose(this._remote);
    }
  }

  override dispose(): void {
    for (const timer of this._pendingUserInitiated.values()) {
      clearTimeout(timer);
    }
    this._pendingUserInitiated.clear();
    // Tear down owned tabs BEFORE super.dispose() runs disposeWithMe: super
    // unregisters the 'remote' view, so any tab still in the UI after that
    // would render `null` and become un-closeable.
    for (const sessionId of [...this._ownedTabs]) {
      this._tearDownPerSession(sessionId);
      try {
        this._terminalUIService.removeSession(sessionId);
      } catch (err) {
        this._logService.warn(`[RemoteSessionBridgeController] removeSession ${sessionId} during dispose failed:`, err);
      }
    }
    this._ownedTabs.clear();
    super.dispose();
    for (const subs of this._perSessionSubs.values()) {
      for (const sub of subs) {
        sub.unsubscribe();
      }
    }
    this._perSessionSubs.clear();
  }

  /**
   * Called by ParticipantJoinDialog right before it dispatches `createSession`.
   * Marks `sessionId` so that when it later arrives on `sessionCreated$`,
   * `_addRemoteTab` calls `setActiveSession`. Without this signal, focus
   * stays on whatever tab the user was on — necessary because the stream
   * also fires for non-user-driven attaches (server-pushed reattach, second
   * device flows).
   *
   * Auto-expires after USER_INITIATED_TTL_MS so a never-arrived sid (relay
   * timeout, claim rejected) doesn't hijack focus minutes later.
   */
  markUserInitiated(sessionId: string): void {
    if (this._disposed) {
      return;
    }
    const existing = this._pendingUserInitiated.get(sessionId);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this._pendingUserInitiated.delete(sessionId);
    }, USER_INITIATED_TTL_MS);
    this._pendingUserInitiated.set(sessionId, timer);
  }

  private _registerView(): void {
    this.disposeWithMe(this._viewRegistry.registerView(REMOTE_SESSION_TYPE, RemoteTerminalView));
    this.disposeWithMe(this._viewRegistry.registerTabAdornment(REMOTE_SESSION_TYPE, RemoteTabAdornment));
  }

  /**
   * Reconcile the tab list against `sessions$`:
   *   - sid newly present → addRemoteTab
   *   - sid newly absent  → removeRemoteTab
   *
   * Using `sessions$` (shareReplay'd, current-state observable) rather than
   * the pair of `sessionCreated$ / sessionClosed$` events keeps the bridge
   * correct on late mount: HMR or plugin re-instantiation gives the fresh
   * subscriber the current snapshot, so already-attached sessions still show
   * up as tabs without needing to have observed the original create event.
   */
  private _wireSessionLifecycle(remote: IRemoteSessionService): void {
    remote.sessions$
      .pipe(takeUntil(this.dispose$))
      .subscribe((sessions) => {
        const incoming = new Set(sessions);
        for (const sid of incoming) {
          if (!this._ownedTabs.has(sid)) {
            this._addRemoteTab(sid, remote);
          }
        }
        for (const sid of [...this._ownedTabs]) {
          if (!incoming.has(sid)) {
            this._removeRemoteTab(sid);
          }
        }
      });
  }

  /**
   * Watch the tab list. When a remote tab we own disappears, drive
   * `closeSession` on the backend so the daemon sees us leave promptly.
   * Idempotent at the main-process end — no exponential backoff needed,
   * matches SSH `closeSession` semantics.
   */
  private _wireUserClose(remote: IRemoteSessionService): void {
    this._terminalUIService.sessions$
      .pipe(takeUntil(this.dispose$))
      .subscribe((sessions: readonly ITerminalSession[]) => {
        const visible = new Set(sessions.filter((s) => s.type === REMOTE_SESSION_TYPE).map((s) => s.id));
        for (const sid of [...this._ownedTabs]) {
          if (visible.has(sid)) {
            continue;
          }
          // Drop bookkeeping first so the sessionClosed$ that follows doesn't
          // try to remove the tab again (already gone).
          this._tearDownPerSession(sid);
          this._ownedTabs.delete(sid);
          remote.closeSession(sid).catch((err) => {
            this._logService.error(`[RemoteSessionBridgeController] closeSession ${sid} failed:`, err);
          });
        }
      });
  }

  private _consumeUserInitiated(sessionId: string): boolean {
    const timer = this._pendingUserInitiated.get(sessionId);
    if (!timer) {
      return false;
    }
    clearTimeout(timer);
    this._pendingUserInitiated.delete(sessionId);
    return true;
  }

  private _addRemoteTab(sessionId: string, remote: IRemoteSessionService): void {
    const fallbackName = this._localeService.t('shared-terminal-ui.remote.tab-name');
    this._terminalUIService.addSession({
      id: sessionId,
      type: REMOTE_SESSION_TYPE,
      hostId: sessionId,
      hostName: fallbackName,
      title: `${fallbackName} #${sessionId.slice(0, 8)}`,
      status: 'connecting',
    });
    if (this._consumeUserInitiated(sessionId)) {
      this._terminalUIService.setActiveSession(sessionId);
    }
    this._ownedTabs.add(sessionId);

    const subs: Subscription[] = [];
    subs.push(remote.status$(sessionId)
      .pipe(takeUntil(this.dispose$))
      .subscribe((state) => {
        this._terminalUIService.updateSessionStatus(sessionId, mapStatusToTabStatus(state));
      })
    );

    // Title sync: react to session_metadata events.
    subs.push(remote.event$(sessionId)
      .pipe(takeUntil(this.dispose$))
      .subscribe((event: RemoteSessionEvent) => {
        if (event.type !== 'session_metadata') {
          return;
        }
        const title = buildTabTitle(
          { ownerLabel: event.ownerLabel ?? undefined, title: event.title ?? undefined },
          fallbackName,
          sessionId
        );
        this._terminalUIService.updateSessionTitle(sessionId, title);
      })
    );

    this._perSessionSubs.set(sessionId, subs);
  }

  private _removeRemoteTab(sessionId: string): void {
    this._tearDownPerSession(sessionId);
    this._ownedTabs.delete(sessionId);
    this._terminalUIService.removeSession(sessionId);
  }

  private _tearDownPerSession(sessionId: string): void {
    const subs = this._perSessionSubs.get(sessionId);
    if (!subs) {
      return;
    }
    for (const sub of subs) {
      sub.unsubscribe();
    }
    this._perSessionSubs.delete(sessionId);
  }
}

function mapStatusToTabStatus(state: RemoteSessionStatus): 'connecting' | 'ready' | 'closed' | 'error' {
  switch (state) {
    case RemoteSessionStatus.CONNECTED:
      return 'ready';
    case RemoteSessionStatus.CONNECTING:
      return 'connecting';
    case RemoteSessionStatus.CLOSED:
      return 'closed';
    case RemoteSessionStatus.ERROR:
      return 'error';
    case RemoteSessionStatus.IDLE:
    default:
      return 'connecting';
  }
}

interface IBuildTabTitleMetadata {
  readonly ownerLabel?: string;
  readonly title?: string;
}

function buildTabTitle(metadata: IBuildTabTitleMetadata, fallbackName: string, sessionId: string): string {
  // Priority matches the owner UX expectation:
  //   1. owner-visible title (local PTY OSC + manual rename land here)
  //   2. ownerLabel (display name from daemon) — falls back when title is empty
  //   3. generic "Shared Session #abc12345" as a last resort
  if (metadata.title && metadata.title.length > 0) {
    return metadata.title;
  }
  if (metadata.ownerLabel && metadata.ownerLabel.length > 0) {
    return `${fallbackName}: ${metadata.ownerLabel}`;
  }
  return `${fallbackName} #${sessionId.slice(0, 8)}`;
}
