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

import type { IPtyMultiplexerService as IPtyMultiplexerServiceType, IRegisteredPty, IShareableSession } from '@termlnk/shared-terminal';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable, ILogService, Inject, Optional } from '@termlnk/core';
import { ISSHSessionService, ITerminalSessionNotifyService } from '@termlnk/rpc';
import { IPtyMultiplexerService } from '@termlnk/shared-terminal';
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
}

export const IShareSessionService = createIdentifier<IShareSessionService>(
  'rpc-server.share-session-service'
);

export class ShareSessionService extends Disposable implements IShareSessionService {
  private readonly _registrations = new Map<string, ISharedRegistration>();
  private readonly _sessions = new Map<string, ISessionMeta>();
  private readonly _shareable$ = new BehaviorSubject<readonly IShareableSession[]>([]);
  readonly shareable$: Observable<readonly IShareableSession[]> = this._shareable$.asObservable();

  constructor(
    @Inject(ILogService) private readonly _logService: ILogService,
    @Optional(IPtyMultiplexerService) private readonly _mux: IPtyMultiplexerServiceType | null,
    @Inject(ISSHSessionService) private readonly _sshSessionService: ISSHSessionService,
    @Inject(IPTYSessionService) private readonly _ptySessionService: IPTYSessionService,
    @Inject(ITerminalSessionNotifyService) private readonly _notifyService: ITerminalSessionNotifyService
  ) {
    super();
    this.disposeWithMe(this._notifyService.sessionCreated$.subscribe((event) => {
      this._sessions.set(event.sessionId, {
        sessionId: event.sessionId,
        kind: event.type,
        title: event.hostLabel ?? `${event.type}:${event.sessionId.slice(0, 8)}`,
        hostId: event.hostId,
      });
      this._publish();
    }));
    this.disposeWithMe(this._notifyService.sessionClosed$.subscribe((event) => {
      if (this._registrations.has(event.sessionId)) {
        // Implicit stop on PTY exit. Errors swallowed; logged inside stopSharing.
        void this.stopSharing(event.sessionId);
      }
      this._sessions.delete(event.sessionId);
      this._publish();
    }));
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
    this._logService.log(`[ShareSessionService] stopped sharing ${sessionId}`);
    this._publish();
  }

  listShareable(): readonly IShareableSession[] {
    return this._shareable$.getValue();
  }

  isShared(sessionId: string): boolean {
    return this._registrations.has(sessionId);
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
