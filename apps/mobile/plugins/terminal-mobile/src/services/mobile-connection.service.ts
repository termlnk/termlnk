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

// Connection coordinator. Establishes the SSH transport for a host keyed by hostId and
// exposes per-host status so the Hosts list can animate a row while it connects and the
// terminal / SFTP screens can attach to the live session. It deliberately stops at the
// transport: startShell() (needs the terminal-measured PTY size) and openSftp() stay with
// the screen that knows the intent.

import type { ILogService } from '@termlnk/core';
import type { IMobileHostRepository, IMobileIdentityRepository, IMobileSshKeyRepository } from '@termlnk/database-mobile';
import type { Observable } from 'rxjs';
import type { IHostConnectArgs } from './auto-connect-from-vault';
import type { IMobileSshSession } from './mobile-ssh-client.service';
import type { MobileSshSessionEvent } from './mobile-ssh-session-event';
import { createIdentifier, Disposable, ILogService as ILogServiceId, Inject } from '@termlnk/core';
import { IMobileHostRepository as IMobileHostRepositoryId, IMobileIdentityRepository as IMobileIdentityRepositoryId, IMobileSshKeyRepository as IMobileSshKeyRepositoryId } from '@termlnk/database-mobile';
import { BehaviorSubject, Subject } from 'rxjs';
import { resolveHostConnectArgs } from './auto-connect-from-vault';
import { IMobileSshClientService } from './mobile-ssh-client.service';

export type HostConnectionStatus = 'idle' | 'resolving' | 'connecting' | 'connected' | 'needs-credentials' | 'error';

export interface IHostConnectionState {
  readonly status: HostConnectionStatus;
  readonly session: IMobileSshSession | null;
  readonly error: string | null;
}

export interface IMobileManualCredentials {
  readonly username: string;
  readonly password: string;
}

export interface IMobileConnectionService {
  // Per-host connection state. The list subscribes to animate connecting rows.
  readonly connections$: Observable<ReadonlyMap<string, IHostConnectionState>>;
  // Interactive events (host key verify, auth failure). The terminal screen subscribes
  // and shows the appropriate sheet; each event carries a respond() callback that
  // resumes the suspended connection handshake.
  readonly event$: Observable<MobileSshSessionEvent>;
  // Resolve a vault credential and open the SSH transport. Idempotent: a connected host
  // returns its existing session, an in-flight connect returns the same promise, and a host
  // with no usable credential resolves to null with status 'needs-credentials' so the caller
  // can route to the manual-entry screen.
  connect: (hostId: string) => Promise<IMobileSshSession | null>;
  // Manual-entry fallback when connect() reported 'needs-credentials' or 'error'.
  connectManual: (hostId: string, creds: IMobileManualCredentials) => Promise<IMobileSshSession | null>;
  getState: (hostId: string) => IHostConnectionState;
  disconnect: (hostId: string) => void;
}

export const IMobileConnectionService = createIdentifier<IMobileConnectionService>('mobile.connection.service');

const IDLE_STATE: IHostConnectionState = { status: 'idle', session: null, error: null };

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class MobileConnectionService extends Disposable implements IMobileConnectionService {
  private readonly _connections$ = new BehaviorSubject<ReadonlyMap<string, IHostConnectionState>>(new Map());
  readonly connections$: Observable<ReadonlyMap<string, IHostConnectionState>> = this._connections$.asObservable();

  private readonly _event$ = new Subject<MobileSshSessionEvent>();
  readonly event$: Observable<MobileSshSessionEvent> = this._event$.asObservable();

  // In-flight transport connects keyed by hostId so a list tap and the screen mount dedupe
  // onto one SSH connection instead of racing two.
  private readonly _inflight = new Map<string, Promise<IMobileSshSession | null>>();
  private readonly _pendingAuthResolves = new Set<(value: IMobileSshSession | null) => void>();

  private readonly _sshClient: IMobileSshClientService;
  private readonly _hostRepo: IMobileHostRepository;
  private readonly _identityRepo: IMobileIdentityRepository;
  private readonly _keyRepo: IMobileSshKeyRepository;
  private readonly _logService: ILogService;

  constructor(
    @Inject(IMobileSshClientService) sshClient: IMobileSshClientService,
    @Inject(IMobileHostRepositoryId) hostRepo: IMobileHostRepository,
    @Inject(IMobileIdentityRepositoryId) identityRepo: IMobileIdentityRepository,
    @Inject(IMobileSshKeyRepositoryId) keyRepo: IMobileSshKeyRepository,
    @Inject(ILogServiceId) logService: ILogService
  ) {
    super();
    this._sshClient = sshClient;
    this._hostRepo = hostRepo;
    this._identityRepo = identityRepo;
    this._keyRepo = keyRepo;
    this._logService = logService;
  }

  override dispose(): void {
    const connections = this._connections$.getValue();

    for (const resolve of this._pendingAuthResolves) {
      resolve(null);
    }
    this._pendingAuthResolves.clear();

    super.dispose();

    for (const state of connections.values()) {
      state.session?.disconnect();
    }
    this._inflight.clear();
    this._connections$.complete();
    this._event$.complete();
  }

  getState(hostId: string): IHostConnectionState {
    return this._connections$.getValue().get(hostId) ?? IDLE_STATE;
  }

  connect(hostId: string): Promise<IMobileSshSession | null> {
    const existing = this.getState(hostId);
    if (existing.status === 'connected' && existing.session) {
      return Promise.resolve(existing.session);
    }
    return this._track(hostId, () => this._resolveAndConnect(hostId));
  }

  connectManual(hostId: string, creds: IMobileManualCredentials): Promise<IMobileSshSession | null> {
    return this._track(hostId, () => this._connectManual(hostId, creds));
  }

  disconnect(hostId: string): void {
    this.getState(hostId).session?.disconnect();
    this._remove(hostId);
  }

  // Shares the in-flight slot so concurrent connect()/connectManual() calls dedupe.
  private _track(hostId: string, run: () => Promise<IMobileSshSession | null>): Promise<IMobileSshSession | null> {
    const inflight = this._inflight.get(hostId);
    if (inflight) {
      return inflight;
    }
    const promise = run().finally(() => {
      this._inflight.delete(hostId);
    });
    this._inflight.set(hostId, promise);
    return promise;
  }

  private async _resolveAndConnect(hostId: string): Promise<IMobileSshSession | null> {
    this._patch(hostId, { status: 'resolving', session: null, error: null });
    let args: IHostConnectArgs | null;
    try {
      const full = await this._hostRepo.getInfo(hostId);
      if (!full) {
        this._patch(hostId, { status: 'error', session: null, error: 'Host not found in vault snapshot' });
        return null;
      }
      args = await resolveHostConnectArgs(full, this._identityRepo, this._keyRepo);
    } catch (err) {
      this._fail(hostId, err);
      return null;
    }
    if (!args) {
      // No usable credential on file — the caller routes to the manual-entry screen.
      this._patch(hostId, { status: 'needs-credentials', session: null, error: null });
      return null;
    }
    return this._openTransport(hostId, args);
  }

  private async _connectManual(hostId: string, creds: IMobileManualCredentials): Promise<IMobileSshSession | null> {
    let full;
    try {
      full = await this._hostRepo.getInfo(hostId);
    } catch (err) {
      this._fail(hostId, err);
      return null;
    }
    if (!full?.addr) {
      this._patch(hostId, { status: 'error', session: null, error: 'Host has no address' });
      return null;
    }
    return this._openTransport(hostId, {
      host: full.addr,
      port: full.port ?? 22,
      username: creds.username,
      password: creds.password,
    });
  }

  private async _openTransport(hostId: string, args: IHostConnectArgs): Promise<IMobileSshSession | null> {
    this._patch(hostId, { status: 'connecting', session: null, error: null });
    try {
      const session = await this._sshClient.connect({
        ...args,
        hostId,
        onInteraction: (event) => this._event$.next(event),
      });
      this._patch(hostId, { status: 'connected', session, error: null });
      return session;
    } catch (err) {
      if (this._isAuthFailed(err)) {
        return this._handleAuthFailure(hostId, args, err);
      }
      this._fail(hostId, err);
      return null;
    }
  }

  private _isAuthFailed(err: unknown): boolean {
    return (
      err != null
      && typeof err === 'object'
      && 'kind' in err
      && (err as { kind: string }).kind === 'authFailed'
    );
  }

  private _handleAuthFailure(
    hostId: string,
    originalArgs: IHostConnectArgs,
    err: unknown
  ): Promise<IMobileSshSession | null> {
    const message = err instanceof Error ? err.message : String(err);
    // Capture only non-sensitive fields; password/privateKey must not linger
    // in the closure while the auth-failed sheet is open.
    const { host, port, username, passphrase } = originalArgs;
    return new Promise<IMobileSshSession | null>((resolve) => {
      this._pendingAuthResolves.add(resolve);
      this._event$.next({
        type: 'auth_failed',
        hostId,
        host,
        port,
        username,
        message,
        respond: (newPassword) => {
          this._pendingAuthResolves.delete(resolve);
          if (newPassword === null) {
            this._fail(hostId, err);
            resolve(null);
          } else {
            resolve(
              this._openTransport(hostId, {
                host,
                port,
                username,
                passphrase,
                password: newPassword,
              })
            );
          }
        },
      });
    });
  }

  private _fail(hostId: string, err: unknown): void {
    const message = errMessage(err);
    this._logService.warn('[MobileConnectionService] connect failed:', hostId, message);
    this._patch(hostId, { status: 'error', session: null, error: message });
  }

  private _patch(hostId: string, state: IHostConnectionState): void {
    const next = new Map(this._connections$.getValue());
    next.set(hostId, state);
    this._connections$.next(next);
  }

  private _remove(hostId: string): void {
    const current = this._connections$.getValue();
    if (!current.has(hostId)) {
      return;
    }
    const next = new Map(current);
    next.delete(hostId);
    this._connections$.next(next);
  }
}
