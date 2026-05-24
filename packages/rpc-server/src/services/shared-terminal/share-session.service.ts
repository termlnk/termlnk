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

import type { IPtyMultiplexerService as IPtyMultiplexerServiceType, IRegisteredPty, IShareableSession, IShareDaemonService } from '@termlnk/shared-terminal';
import type { Observable } from 'rxjs';
import { IAuthService } from '@termlnk/auth';
import { createIdentifier, Disposable, ILogService, Optional } from '@termlnk/core';
import { ISSHSessionService, ITerminalSessionNotifyService } from '@termlnk/rpc';
import { IPtyMultiplexerService, IShareDaemonService as IShareDaemonServiceId } from '@termlnk/shared-terminal';
import { IPTYSessionService } from '@termlnk/terminal';
import { BehaviorSubject } from 'rxjs';
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
 * IShareSessionService — explicit "start sharing" / "stop sharing" coordinator for the
 * owner-side desktop UI.
 */
export interface IShareSessionService {
  /** Real-time list of every active SSH + local PTY session, each annotated with shared flag. */
  readonly shareable$: Observable<readonly IShareableSession[]>;

  /** Share the SSH session with the given id; idempotent. Throws if unknown. */
  shareSshSession(sessionId: string): Promise<void>;

  /** Share the local PTY session with the given id; idempotent. */
  sharePtySession(sessionId: string): Promise<void>;

  /** Stop sharing the session. No-op if not currently shared. */
  stopSharing(sessionId: string): Promise<void>;

  /** Snapshot of currently active shareable sessions (UI hydrate before subscription lands). */
  listShareable(): readonly IShareableSession[];

  /** Whether the session is currently being shared. */
  isShared(sessionId: string): boolean;

  /**
   * Renderer-driven title sync. When the owner's terminal tab title changes
   * (e.g. local PTY OSC update, manual rename), the renderer forwards the new
   * title here; we update our internal meta and push the new value through
   * IShareDaemonService.pushSessionMetadata so every joiner's tab title
   * matches the owner's. No-op if the session isn't being shared.
   */
  setSessionTitle(sessionId: string, title: string): void;
}

export const IShareSessionService = createIdentifier<IShareSessionService>('rpc-server.share-session-service');

export class ShareSessionService extends Disposable implements IShareSessionService {
  private readonly _registrations = new Map<string, ISharedRegistration>();
  private readonly _sessions = new Map<string, ISessionMeta>();
  private readonly _shareable$ = new BehaviorSubject<readonly IShareableSession[]>([]);
  readonly shareable$: Observable<readonly IShareableSession[]> = this._shareable$.asObservable();
  /**
   * Current owner display label (from IAuthService.currentUser$). Cached so we
   * can push it on every shareXxxSession + react to user changes. Falls back to
   * email when displayName is empty, then to `undefined` (no label) when the
   * user isn't signed in.
   */
  private _ownerLabel: string | undefined;
  /**
   * Titles set via setSessionTitle before the corresponding sessionCreated$
   * event arrives. Drained when the meta lands so the renderer's debounced
   * title push isn't silently dropped on a tight share-then-rename race.
   */
  private readonly _pendingTitles = new Map<string, string>();

  constructor(
    @ILogService private readonly _logService: ILogService,
    @ISSHSessionService private readonly _sshSessionService: ISSHSessionService,
    @IPTYSessionService private readonly _ptySessionService: IPTYSessionService,
    @ITerminalSessionNotifyService private readonly _notifyService: ITerminalSessionNotifyService,
    @Optional(IPtyMultiplexerService) private readonly _mux?: IPtyMultiplexerServiceType,
    @Optional(IShareDaemonServiceId) private readonly _shareDaemon?: IShareDaemonService,
    @Optional(IAuthService) private readonly _authService?: IAuthService
  ) {
    super();

    this._init();
  }

  private _init() {
    this.disposeWithMe(this._notifyService.sessionCreated$.subscribe((event) => {
      const queuedTitle = this._pendingTitles.get(event.sessionId);
      this._pendingTitles.delete(event.sessionId);
      const fallbackTitle = event.hostLabel ?? `${event.type}:${event.sessionId.slice(0, 8)}`;
      this._sessions.set(event.sessionId, {
        sessionId: event.sessionId,
        kind: event.type,
        // A title that arrived via setSessionTitle before this event takes
        // precedence over the auto-generated fallback — the renderer-side
        // OSC update would otherwise be lost on a tight share+rename race.
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
        // Implicit stop on PTY exit. Errors swallowed; logged inside stopSharing.
        void this.stopSharing(event.sessionId);
      }
      this._sessions.delete(event.sessionId);
      this._pendingTitles.delete(event.sessionId);
      this._publish();
    }));

    if (this._authService) {
      // Track the owner display label across sign-in/out + profile updates.
      // We rebroadcast to every shared session whenever it changes so joiners'
      // tab "Shared: <name>" stays accurate without manual refresh. Sign-out
      // sends `null` (not undefined) so the daemon clears the cached value
      // and joiners' tabs drop the previous owner's name.
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

  override dispose(): void {
    super.dispose();
    for (const reg of this._registrations.values()) {
      try {
        reg.registered.unregister();
      } catch (err) {
        this._logService.error(`[ShareSessionService] unregister ${reg.sessionId} failed:`, err);
      }
      reg.source.dispose();
    }
    this._registrations.clear();
    this._sessions.clear();
    this._shareable$.complete();
  }

  async shareSshSession(sessionId: string): Promise<void> {
    if (this._registrations.has(sessionId)) {
      return;
    }
    if (!this._mux) {
      throw new Error('[ShareSessionService] shared-terminal core is not registered in this process');
    }
    const session = this._sshSessionService.getSession(sessionId);
    if (!session) {
      throw new Error(`[ShareSessionService] SSH session ${sessionId} not found`);
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
    this._logService.log(`[ShareSessionService] sharing SSH session ${sessionId} as "${source.title}"`);
    this._pushInitialMetadata(sessionId);
    this._publish();
  }

  async sharePtySession(sessionId: string): Promise<void> {
    if (this._registrations.has(sessionId)) {
      return;
    }
    if (!this._mux) {
      throw new Error('[ShareSessionService] shared-terminal core is not registered in this process');
    }
    const session = this._ptySessionService.getSession(sessionId);
    if (!session) {
      throw new Error(`[ShareSessionService] PTY session ${sessionId} not found`);
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
    this._logService.log(`[ShareSessionService] sharing local PTY session ${sessionId}`);
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
      this._logService.error(`[ShareSessionService] unregister ${sessionId} failed:`, err);
    }
    reg.source.dispose();
    this._registrations.delete(sessionId);
    // Tear down the daemon-mode relay socket associated with this session.
    // Without this the WebSocket stays connected to the relay (server keeps
    // the daemon slot occupied), and any re-share of the same sessionId
    // would observe `isAttached(sid) === true` and silently drop the new
    // sharedKey, breaking joiners.
    if (this._shareDaemon) {
      try {
        await this._shareDaemon.detachSession(sessionId);
      } catch (err) {
        this._logService.warn(`[ShareSessionService] shareDaemon.detachSession ${sessionId} failed:`, err);
      }
    }
    this._logService.log(`[ShareSessionService] stopped sharing ${sessionId}`);
    this._publish();
  }

  listShareable(): readonly IShareableSession[] {
    return this._shareable$.getValue();
  }

  isShared(sessionId: string): boolean {
    return this._registrations.has(sessionId);
  }

  setSessionTitle(sessionId: string, title: string): void {
    const meta = this._sessions.get(sessionId);
    if (!meta) {
      // sessionCreated$ hasn't fanned out for this sid yet — queue the title
      // and apply on arrival. Without this the renderer's first OSC-driven
      // title push for a freshly-created shared session would be silently
      // dropped here, leaving joiners on the fallback name.
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
}
