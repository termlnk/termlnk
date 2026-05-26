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

import type { IDriverState, IPairingService, IParticipant, IPtyMultiplexerService as IPtyMultiplexerServiceType, IRegisteredPty, IShareableSession, IShareDaemonService, ISharedSession, ISharedSessionService } from '@termlnk/shared-terminal';
import type { Observable } from 'rxjs';
import { IAuthService } from '@termlnk/auth';
import { Disposable, ILogService, Optional } from '@termlnk/core';
import { ISSHSessionService, ITerminalSessionNotifyService } from '@termlnk/rpc';
import { IPairingService as IPairingServiceId, IPtyMultiplexerService, IShareDaemonService as IShareDaemonServiceId } from '@termlnk/shared-terminal';
import { IPTYSessionService } from '@termlnk/terminal';
import { BehaviorSubject, EMPTY, firstValueFrom } from 'rxjs';
import { LocalPtySource, SSHPtySource } from './pty-source.adapters';

interface ISharedRegistration {
  readonly sessionId: string;
  readonly kind: 'ssh' | 'local';
  readonly source: SSHPtySource | LocalPtySource;
  readonly registered: IRegisteredPty;
  readonly startedAt: number;
}

interface ISessionMeta {
  readonly sessionId: string;
  readonly kind: 'ssh' | 'local';
  readonly title: string;
  readonly hostId?: string;
}

/**
 * Owner-side control plane implementation — implements `ISharedSessionService`.
 *
 * Composes the per-process PtyMultiplexer (sessions / participants / driver
 * arbitration) with the share registration ledger (which SSH/PTY sessions are
 * exposed). Title sync forwards renderer-side title changes into the daemon's
 * `pushSessionMetadata` broadcast.
 */
export class SharedSessionService extends Disposable implements ISharedSessionService {
  private readonly _registrations = new Map<string, ISharedRegistration>();
  private readonly _sessions = new Map<string, ISessionMeta>();
  private readonly _shareable$ = new BehaviorSubject<readonly IShareableSession[]>([]);
  readonly shareable$: Observable<readonly IShareableSession[]> = this._shareable$.asObservable();

  /**
   * Current owner display label (from IAuthService.currentUser$). Cached so we
   * can push it on every shareXxxSession + react to user changes. Falls back to
   * email when displayName is empty, then to `undefined` when not signed in.
   */
  private _ownerLabel: string | undefined;
  /**
   * Titles set via setSessionTitle before the corresponding sessionCreated$
   * event arrives. Drained when the meta lands so a tight share-then-rename
   * race does not lose the renderer's first OSC-driven title push.
   */
  private readonly _pendingTitles = new Map<string, string>();

  constructor(
    @ILogService private readonly _logService: ILogService,
    @ISSHSessionService private readonly _sshSessionService: ISSHSessionService,
    @IPTYSessionService private readonly _ptySessionService: IPTYSessionService,
    @ITerminalSessionNotifyService private readonly _notifyService: ITerminalSessionNotifyService,
    @Optional(IPtyMultiplexerService) private readonly _mux?: IPtyMultiplexerServiceType,
    @Optional(IShareDaemonServiceId) private readonly _shareDaemon?: IShareDaemonService,
    @Optional(IAuthService) private readonly _authService?: IAuthService,
    @Optional(IPairingServiceId) private readonly _pairingService?: IPairingService
  ) {
    super();
    this._init();
  }

  override dispose(): void {
    super.dispose();
    for (const reg of this._registrations.values()) {
      try {
        reg.registered.unregister();
      } catch (err) {
        this._logService.error(`[SharedSessionService] unregister ${reg.sessionId} failed:`, err);
      }
      reg.source.dispose();
    }
    this._registrations.clear();
    this._sessions.clear();
    this._shareable$.complete();
  }

  // ---------------------------------------------------------------------------
  // Sessions (mux passthrough)
  // ---------------------------------------------------------------------------

  get sessions$(): Observable<readonly ISharedSession[]> {
    return this._mux?.sessions$ ?? EMPTY;
  }

  async listSessions(): Promise<readonly ISharedSession[]> {
    if (!this._mux) {
      return [];
    }
    return firstValueFrom(this._mux.sessions$);
  }

  participants$(sessionId: string): Observable<readonly IParticipant[]> {
    return this._mux?.participants$(sessionId) ?? EMPTY;
  }

  driverState$(sessionId: string): Observable<IDriverState> {
    return this._mux?.driverState$(sessionId) ?? EMPTY;
  }

  // ---------------------------------------------------------------------------
  // Driver arbitration
  // ---------------------------------------------------------------------------

  async setDriver(sessionId: string, clientId: string | null): Promise<void> {
    this._requireMux().setDriver(sessionId, clientId);
  }

  async lockDriver(sessionId: string, clientId: string): Promise<void> {
    this._requireMux().lockDriver(sessionId, clientId);
  }

  async unlockDriver(sessionId: string): Promise<void> {
    this._requireMux().unlockDriver(sessionId);
  }

  async kick(sessionId: string, clientId: string, reason?: string): Promise<void> {
    this._requireMux().kick(sessionId, clientId, reason);
  }

  // ---------------------------------------------------------------------------
  // Sharing lifecycle
  // ---------------------------------------------------------------------------

  async listShareable(): Promise<readonly IShareableSession[]> {
    return this._shareable$.getValue();
  }

  async shareSshSession(sessionId: string): Promise<void> {
    if (this._registrations.has(sessionId)) {
      return;
    }
    if (!this._mux) {
      throw new Error('[SharedSessionService] shared-terminal core is not registered in this process');
    }
    const session = this._sshSessionService.getSession(sessionId);
    if (!session) {
      throw new Error(`[SharedSessionService] SSH session ${sessionId} not found`);
    }
    const source = new SSHPtySource(session);
    const registered = this._mux.register(source);
    this._registrations.set(sessionId, {
      sessionId,
      kind: 'ssh',
      source,
      registered,
      startedAt: Date.now(),
    });
    this._logService.log(`[SharedSessionService] sharing SSH session ${sessionId} as "${source.title}"`);
    this._pushInitialMetadata(sessionId);
    this._publish();
  }

  async sharePtySession(sessionId: string): Promise<void> {
    if (this._registrations.has(sessionId)) {
      return;
    }
    if (!this._mux) {
      throw new Error('[SharedSessionService] shared-terminal core is not registered in this process');
    }
    const session = this._ptySessionService.getSession(sessionId);
    if (!session) {
      throw new Error(`[SharedSessionService] PTY session ${sessionId} not found`);
    }
    const source = new LocalPtySource(session);
    const registered = this._mux.register(source);
    this._registrations.set(sessionId, {
      sessionId,
      kind: 'local',
      source,
      registered,
      startedAt: Date.now(),
    });
    this._logService.log(`[SharedSessionService] sharing local PTY session ${sessionId}`);
    this._pushInitialMetadata(sessionId);
    this._publish();
  }

  async stopSharing(sessionId: string): Promise<void> {
    const reg = this._registrations.get(sessionId);
    if (!reg) {
      return;
    }
    try {
      reg.registered.unregister();
    } catch (err) {
      this._logService.error(`[SharedSessionService] unregister ${sessionId} failed:`, err);
    }
    reg.source.dispose();
    this._registrations.delete(sessionId);
    // Revoke every active invite for this session BEFORE detaching the daemon.
    // Without this, a participant who cached the URL could re-claim it through
    // /v1/collab/invite/:id/claim and reattach to a relay bucket where the
    // daemon has already left — relay would happily accept the client and the
    // joiner would see "Connected" with no terminal data forever. Each revoke
    // is isolated so a transient failure on one invite (e.g. DB lock) does not
    // strand the rest of the active set; revokeInvite itself is idempotent.
    if (this._pairingService) {
      const pairingService = this._pairingService;
      try {
        const invites = await pairingService.listInvites();
        const active = invites.filter((i) => i.sessionId === sessionId && i.status === 'active');
        await Promise.all(active.map((invite) =>
          pairingService.revokeInvite(invite.inviteId).catch((err) => {
            this._logService.warn(`[SharedSessionService] revoke invite ${invite.inviteId} failed:`, err);
          })
        ));
      } catch (err) {
        this._logService.warn(`[SharedSessionService] listInvites for ${sessionId} failed:`, err);
      }
    }
    // Tear down the daemon-mode relay socket associated with this session.
    // Without this the WebSocket stays connected to the relay (server keeps
    // the daemon slot occupied), and any re-share of the same sessionId
    // would observe `isAttached(sid) === true` and silently drop the new
    // sharedKey, breaking joiners.
    if (this._shareDaemon) {
      try {
        await this._shareDaemon.detachSession(sessionId);
      } catch (err) {
        this._logService.warn(`[SharedSessionService] shareDaemon.detachSession ${sessionId} failed:`, err);
      }
    }
    this._logService.log(`[SharedSessionService] stopped sharing ${sessionId}`);
    this._publish();
  }

  async setSessionTitle(sessionId: string, title: string): Promise<void> {
    const meta = this._sessions.get(sessionId);
    if (!meta) {
      // sessionCreated$ hasn't fanned out for this sid yet — queue the title
      // and apply on arrival.
      this._pendingTitles.set(sessionId, title);
      return;
    }
    if (meta.title === title) {
      return;
    }
    this._sessions.set(sessionId, { ...meta, title });
    this._publish();
    if (this._registrations.has(sessionId) && this._shareDaemon) {
      this._shareDaemon.pushSessionMetadata(sessionId, { title });
    }
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private _init() {
    this.disposeWithMe(this._notifyService.sessionCreated$.subscribe((event) => {
      const queuedTitle = this._pendingTitles.get(event.sessionId);
      this._pendingTitles.delete(event.sessionId);
      const fallbackTitle = event.hostLabel ?? `${event.type}:${event.sessionId.slice(0, 8)}`;
      this._sessions.set(event.sessionId, {
        sessionId: event.sessionId,
        kind: event.type,
        title: queuedTitle ?? fallbackTitle,
        hostId: event.hostId,
      });
      if (queuedTitle !== undefined && this._registrations.has(event.sessionId) && this._shareDaemon) {
        this._shareDaemon.pushSessionMetadata(event.sessionId, { title: queuedTitle });
      }
      this._publish();
    }));

    this.disposeWithMe(this._notifyService.sessionClosed$.subscribe((event) => {
      if (this._registrations.has(event.sessionId)) {
        void this.stopSharing(event.sessionId);
      }
      this._sessions.delete(event.sessionId);
      this._pendingTitles.delete(event.sessionId);
      this._publish();
    }));

    if (this._authService) {
      this.disposeWithMe(this._authService.currentUser$.subscribe((user) => {
        const next = user?.displayName?.trim() || user?.email || undefined;
        if (next === this._ownerLabel) {
          return;
        }
        this._ownerLabel = next;
        if (!this._shareDaemon) {
          return;
        }
        for (const sid of this._registrations.keys()) {
          this._shareDaemon.pushSessionMetadata(sid, { ownerLabel: next ?? null });
        }
      }));
    }
  }

  private _pushInitialMetadata(sessionId: string): void {
    if (!this._shareDaemon) {
      return;
    }
    const meta = this._sessions.get(sessionId);
    const payload: { ownerLabel?: string; title?: string } = {};
    if (this._ownerLabel !== undefined) {
      payload.ownerLabel = this._ownerLabel;
    }
    if (meta) {
      payload.title = meta.title;
    }
    this._shareDaemon.pushSessionMetadata(sessionId, payload);
  }

  private _publish(): void {
    const out: IShareableSession[] = [];
    for (const meta of this._sessions.values()) {
      out.push({
        sessionId: meta.sessionId,
        kind: meta.kind,
        title: meta.title,
        hostId: meta.hostId,
        shared: this._registrations.has(meta.sessionId),
      });
    }
    out.sort((a, b) => a.title.localeCompare(b.title));
    this._shareable$.next(out);
  }

  private _requireMux(): IPtyMultiplexerServiceType {
    if (!this._mux) {
      throw new Error('[SharedSessionService] PtyMultiplexerService is unavailable in this runtime');
    }
    return this._mux;
  }
}
