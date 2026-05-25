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

import type { IParticipantSessionMetadata } from '@termlnk/shared-terminal';
import type { ITerminalSession } from '@termlnk/terminal-ui';
import type { Subscription } from 'rxjs';
import { ILogService, Inject, LocaleService, Optional, RxDisposable } from '@termlnk/core';
import { ClientConnectionState, ISharedTerminalService } from '@termlnk/shared-terminal';
import { ITerminalUIService, ITerminalViewRegistry } from '@termlnk/terminal-ui';
import { takeUntil } from 'rxjs';
import { RemoteTabAdornment } from '../views/RemoteTabAdornment';
import { RemoteTerminalView } from '../views/RemoteTerminalView';

export const REMOTE_SESSION_TYPE = 'remote';

const DISCONNECT_INITIAL_BACKOFF_MS = 250;
const DISCONNECT_MAX_ATTEMPTS = 4;
/**
 * How long after `markUserInitiated(sid)` we still treat the participantSessions$
 * arrival as user-initiated. Bigger than any realistic connectAsParticipant
 * round trip so a slow relay handshake still gets the active-tab focus, but
 * small enough that a stale mark doesn't hijack focus minutes later when the
 * same sid happens to surface for a different reason.
 */
const USER_INITIATED_TTL_MS = 30_000;

/**
 * Bridges the joiner-side ParticipantClientService (per-session state) with
 * ITerminalUIService (tab list) so each successful join shows up as a 'remote'
 * tab and each disconnect/close cleans up symmetrically.
 *
 * Reconciliation rule:
 *   - participantSessions$ is the source of truth for "which remote sessions
 *     should have a tab". We add/remove tabs to match.
 *   - terminalUIService.sessions$ is the source of truth for "what's on screen".
 *     If a tab we created is gone but the participant is still attached, the
 *     user closed it — we drive disconnectParticipant() with bounded retry so
 *     a transient IPC glitch doesn't leave the daemon holding a stale client.
 *
 * Per-session subs (state, metadata) are stored in a Map keyed by sessionId
 * so the controller can clean them up when the session goes away without
 * leaking observables.
 */
export class RemoteSessionBridgeController extends RxDisposable {
  /** Sessions we have created a tab for. Used to detect user-close. */
  private readonly _ownedTabs = new Set<string>();
  /** Per-session subscription groups (state$, metadata$). */
  private readonly _perSessionSubs = new Map<string, Subscription[]>();
  /** Pending retry timers for disconnectParticipant on IPC failure. */
  private readonly _pendingDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
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
    @Optional(ISharedTerminalService) private readonly _shared?: ISharedTerminalService
  ) {
    super();

    this._registerView();
    if (this._shared) {
      this._wireParticipantSessions(this._shared);
      this._wireUserClose(this._shared);
    }
  }

  override dispose(): void {
    for (const timer of this._pendingDisconnectTimers.values()) {
      clearTimeout(timer);
    }
    this._pendingDisconnectTimers.clear();
    for (const timer of this._pendingUserInitiated.values()) {
      clearTimeout(timer);
    }
    this._pendingUserInitiated.clear();
    // Tear down the tabs BEFORE super.dispose() runs disposeWithMe(): super
    // unregisters the 'remote' view from ITerminalViewRegistry, so any tab
    // still in terminalUIService.sessions$ after that point would be a zombie
    // (TerminalContainer renders null for an unknown view type, leaving an
    // un-closable tab in the strip).
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

  private _registerView(): void {
    this.disposeWithMe(this._viewRegistry.registerView(REMOTE_SESSION_TYPE, RemoteTerminalView));
    this.disposeWithMe(this._viewRegistry.registerTabAdornment(REMOTE_SESSION_TYPE, RemoteTabAdornment));
  }

  /**
   * Watch `participantSessions$` and reconcile the tab list:
   *   - sid newly present → addSession + setActive + wire per-session subs
   *   - sid newly absent → tear down per-session subs + remove tab
   */
  private _wireParticipantSessions(shared: ISharedTerminalService): void {
    shared.participantSessions$
      .pipe(takeUntil(this.dispose$))
      .subscribe((sessions) => {
        const incoming = new Set(sessions);
        // Add new sessions.
        for (const sid of incoming) {
          if (this._ownedTabs.has(sid)) {
            continue;
          }
          this._addRemoteTab(sid, shared);
        }
        // Remove sessions the daemon dropped (network drop, owner stopped sharing).
        for (const sid of this._ownedTabs) {
          if (incoming.has(sid)) {
            continue;
          }
          this._removeRemoteTab(sid);
        }
      });
  }

  /**
   * Watch the tab list. When a remote tab we own disappears while the
   * participant is still attached, the user closed the tab — disconnect the
   * backend so the daemon sees us leave promptly. If the IPC mutate fails,
   * we requeue the sid in `_pendingDisconnects` and retry with exponential
   * backoff so a transient renderer↔main glitch doesn't leave the daemon
   * holding a stale client entry forever.
   */
  private _wireUserClose(shared: ISharedTerminalService): void {
    this._terminalUIService.sessions$
      .pipe(takeUntil(this.dispose$))
      .subscribe((sessions: readonly ITerminalSession[]) => {
        const visible = new Set(sessions.filter((s: ITerminalSession) => s.type === REMOTE_SESSION_TYPE).map((s: ITerminalSession) => s.id));
        for (const sid of [...this._ownedTabs]) {
          if (visible.has(sid)) {
            continue;
          }
          // Drop our bookkeeping first so the participantSessions$ removal
          // that follows doesn't try to remove the tab again (already gone).
          this._tearDownPerSession(sid);
          this._ownedTabs.delete(sid);
          this._scheduleDisconnect(shared, sid, 0);
        }
      });
  }

  private _scheduleDisconnect(shared: ISharedTerminalService, sessionId: string, attempt: number): void {
    if (this._disposed) {
      return;
    }
    const existing = this._pendingDisconnectTimers.get(sessionId);
    if (existing) {
      clearTimeout(existing);
      this._pendingDisconnectTimers.delete(sessionId);
    }
    shared.disconnectParticipant(sessionId)
      .then(() => {
        this._pendingDisconnectTimers.delete(sessionId);
      })
      .catch((err) => {
        const next = attempt + 1;
        if (next >= DISCONNECT_MAX_ATTEMPTS) {
          this._logService.error(`[RemoteSessionBridgeController] disconnectParticipant ${sessionId} failed after ${DISCONNECT_MAX_ATTEMPTS} attempts, giving up:`, err);
          this._pendingDisconnectTimers.delete(sessionId);
          return;
        }
        const delayMs = DISCONNECT_INITIAL_BACKOFF_MS * (2 ** attempt);
        this._logService.warn(`[RemoteSessionBridgeController] disconnectParticipant ${sessionId} attempt ${next} retrying in ${delayMs}ms:`, err);
        const timer = setTimeout(() => {
          this._pendingDisconnectTimers.delete(sessionId);
          this._scheduleDisconnect(shared, sessionId, next);
        }, delayMs);
        this._pendingDisconnectTimers.set(sessionId, timer);
      });
  }

  /**
   * Called by ParticipantJoinDialog right before it dispatches
   * `connectAsParticipant(url)`. Marks `sessionId` so that when it later
   * appears on `participantSessions$`, `_addRemoteTab` does call
   * `setActiveSession`. Without this signal, focus stays on whatever tab the
   * user was on — necessary because participantSessions$ also fires for
   * non-user-driven attaches (server-pushed reattach, second-device flows).
   *
   * The mark auto-expires after USER_INITIATED_TTL_MS so a never-arrived sid
   * (relay timeout, claim rejected, etc.) doesn't hijack focus minutes later
   * if the same id surfaces for an unrelated reason.
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

  private _consumeUserInitiated(sessionId: string): boolean {
    const timer = this._pendingUserInitiated.get(sessionId);
    if (!timer) {
      return false;
    }
    clearTimeout(timer);
    this._pendingUserInitiated.delete(sessionId);
    return true;
  }

  private _addRemoteTab(sessionId: string, shared: ISharedTerminalService): void {
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

    subs.push(shared.participantState$(sessionId)
      .pipe(takeUntil(this.dispose$))
      .subscribe((state) => {
        this._terminalUIService.updateSessionStatus(sessionId, mapStateToStatus(state));
      })
    );

    subs.push(shared.participantMetadata$(sessionId)
      .pipe(takeUntil(this.dispose$))
      .subscribe((metadata) => {
        const title = buildTabTitle(metadata, fallbackName, sessionId);
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

function mapStateToStatus(state: ClientConnectionState): 'connecting' | 'ready' | 'closed' | 'error' {
  switch (state) {
    case ClientConnectionState.Connected:
      return 'ready';
    case ClientConnectionState.Pairing:
    case ClientConnectionState.Connecting:
      return 'connecting';
    case ClientConnectionState.Disconnected:
      return 'closed';
    case ClientConnectionState.Error:
      return 'error';
    case ClientConnectionState.Idle:
    default:
      return 'connecting';
  }
}

function buildTabTitle(metadata: IParticipantSessionMetadata | null, fallbackName: string, sessionId: string): string {
  // Priority matches the owner's UX expectation:
  //   1. owner-visible title (local PTY OSC + manual rename land here)
  //   2. ownerLabel (display name from daemon) — falls back when there's no
  //      title yet (e.g. SSH session with empty source.title)
  //   3. generic "Shared Session #abc12345" as a last resort
  if (metadata?.title && metadata.title.length > 0) {
    return metadata.title;
  }
  if (metadata?.ownerLabel && metadata.ownerLabel.length > 0) {
    return `${fallbackName}: ${metadata.ownerLabel}`;
  }
  return `${fallbackName} #${sessionId.slice(0, 8)}`;
}
