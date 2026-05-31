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

import type { IRemoteSession, IRemoteSessionClosedEventNotify, IRemoteSessionCreateOptions, IRemoteSessionCreatedEvent, IRemoteSessionCreateResult, IRemoteSessionService, ISharedSessionInputPolicy, RemoteSessionEvent, RemoteSessionStatus } from '@termlnk/shared-terminal';
import type { Observable } from 'rxjs';
import { Disposable } from '@termlnk/core';
import { decodeBase64Utf8Stream, trpcSubscriptionToObservable } from '@termlnk/rpc';
import { map, share, shareReplay } from 'rxjs';
import { IRPCClientService } from '../rpc-client.service';

/**
 * Renderer-side facade over the tRPC `remoteSession` router — structural twin
 * of `SSHService` / `PTYService`. Implements `IRemoteSessionService` so
 * components inject the same identifier regardless of which side they run on.
 *
 * Per-sid streams are wrapped in `shareReplay({bufferSize:1, refCount:true})`
 * so multi-consumer subscriptions (RemoteTerminalView + bridge controller)
 * share one upstream tRPC subscription. The byte stream (`data$`) uses plain
 * `share()` — replaying old PtyData bytes to a fresh subscriber would re-write
 * characters the snapshot already covered.
 */
export class RemoteSessionService extends Disposable implements IRemoteSessionService {
  private readonly _dataCache = new Map<string, Observable<Uint8Array>>();
  private readonly _statusCache = new Map<string, Observable<RemoteSessionStatus>>();
  private readonly _eventCache = new Map<string, Observable<RemoteSessionEvent>>();
  private readonly _errorCache = new Map<string, Observable<string | null>>();
  private readonly _connectionIdCache = new Map<string, Observable<string | null>>();
  private readonly _driverIdCache = new Map<string, Observable<string | null>>();
  private readonly _inputPolicyCache = new Map<string, Observable<ISharedSessionInputPolicy>>();

  /**
   * Local snapshot of the latest `sessions$` emission so `getSessions()` can
   * honour the synchronous contract without crashing or returning a stale `[]`.
   * Updated by the constructor subscription below, kept in lock-step with
   * the per-sid cache prune.
   */
  private _sessionsSnapshot: readonly string[] = [];

  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();
    // Drop per-sid observable cache entries when the main process retires the
    // session, and keep `_sessionsSnapshot` aligned with the live list.
    // `participantSessions$` is shareReplay'd so this doesn't open an extra
    // tRPC subscription.
    this.disposeWithMe(
      this.sessions$.subscribe((sessions) => {
        this._sessionsSnapshot = sessions;
        const alive = new Set(sessions);
        this._pruneCache(this._dataCache, alive);
        this._pruneCache(this._statusCache, alive);
        this._pruneCache(this._eventCache, alive);
        this._pruneCache(this._errorCache, alive);
        this._pruneCache(this._connectionIdCache, alive);
        this._pruneCache(this._driverIdCache, alive);
        this._pruneCache(this._inputPolicyCache, alive);
      })
    );
  }

  private _pruneCache<T>(cache: Map<string, Observable<T>>, alive: Set<string>): void {
    for (const sid of [...cache.keys()]) {
      if (!alive.has(sid)) {
        cache.delete(sid);
      }
    }
  }

  private get _client() {
    return this._rpcClientService.getClient().remoteSession;
  }

  /**
   * Synchronous snapshot of currently-attached sessionIds. Mirrors
   * `SSHSessionService.getAllSessions()` semantics on the renderer side —
   * returns whatever the most recent `sessions$` emission contained, or `[]`
   * before the first emission lands.
   */
  getSessions(): readonly string[] {
    return this._sessionsSnapshot;
  }

  readonly sessions$: Observable<readonly string[]> = trpcSubscriptionToObservable<readonly string[]>(
    (opts) => this._client.sessions$.subscribe(undefined, opts)
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  readonly sessionCreated$: Observable<IRemoteSessionCreatedEvent> = trpcSubscriptionToObservable<IRemoteSessionCreatedEvent>(
    (opts) => this._client.sessionCreated$.subscribe(undefined, opts)
  ).pipe(share());

  readonly sessionClosed$: Observable<IRemoteSessionClosedEventNotify> = trpcSubscriptionToObservable<IRemoteSessionClosedEventNotify>(
    (opts) => this._client.sessionClosed$.subscribe(undefined, opts)
  ).pipe(share());

  data$(sessionId: string): Observable<Uint8Array> {
    let cached = this._dataCache.get(sessionId);
    if (!cached) {
      // Server batches bytes and ships base64. Decode back to Uint8Array on the
      // renderer side so `term.write(bytes)` works without any UTF-8 assumption.
      cached = trpcSubscriptionToObservable<string>(
        (opts) => this._client.data$.subscribe(sessionId, opts)
      ).pipe(
        map((b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))),
        share()
      );
      this._dataCache.set(sessionId, cached);
    }
    return cached;
  }

  status$(sessionId: string): Observable<RemoteSessionStatus> {
    let cached = this._statusCache.get(sessionId);
    if (!cached) {
      cached = trpcSubscriptionToObservable<RemoteSessionStatus>(
        (opts) => this._client.status$.subscribe(sessionId, opts)
      ).pipe(shareReplay({ bufferSize: 1, refCount: true }));
      this._statusCache.set(sessionId, cached);
    }
    return cached;
  }

  event$(sessionId: string): Observable<RemoteSessionEvent> {
    let cached = this._eventCache.get(sessionId);
    if (!cached) {
      // shareReplay(1) so a tab mounting after the first snapshot still
      // receives the latest event (typically the snapshot itself).
      cached = trpcSubscriptionToObservable<RemoteSessionEvent>(
        (opts) => this._client.event$.subscribe(sessionId, opts)
      ).pipe(shareReplay({ bufferSize: 1, refCount: true }));
      this._eventCache.set(sessionId, cached);
    }
    return cached;
  }

  error$(sessionId: string): Observable<string | null> {
    let cached = this._errorCache.get(sessionId);
    if (!cached) {
      cached = trpcSubscriptionToObservable<string | null>(
        (opts) => this._client.error$.subscribe(sessionId, opts)
      ).pipe(shareReplay({ bufferSize: 1, refCount: true }));
      this._errorCache.set(sessionId, cached);
    }
    return cached;
  }

  connectionId$(sessionId: string): Observable<string | null> {
    let cached = this._connectionIdCache.get(sessionId);
    if (!cached) {
      cached = trpcSubscriptionToObservable<string | null>(
        (opts) => this._client.connectionId$.subscribe(sessionId, opts)
      ).pipe(shareReplay({ bufferSize: 1, refCount: true }));
      this._connectionIdCache.set(sessionId, cached);
    }
    return cached;
  }

  driverId$(sessionId: string): Observable<string | null> {
    let cached = this._driverIdCache.get(sessionId);
    if (!cached) {
      cached = trpcSubscriptionToObservable<string | null>(
        (opts) => this._client.driverId$.subscribe(sessionId, opts)
      ).pipe(shareReplay({ bufferSize: 1, refCount: true }));
      this._driverIdCache.set(sessionId, cached);
    }
    return cached;
  }

  inputPolicy$(sessionId: string): Observable<ISharedSessionInputPolicy> {
    let cached = this._inputPolicyCache.get(sessionId);
    if (!cached) {
      cached = trpcSubscriptionToObservable<ISharedSessionInputPolicy>(
        (opts) => this._client.inputPolicy$.subscribe(sessionId, opts)
      ).pipe(shareReplay({ bufferSize: 1, refCount: true }));
      this._inputPolicyCache.set(sessionId, cached);
    }
    return cached;
  }

  async createSession(options: IRemoteSessionCreateOptions): Promise<IRemoteSessionCreateResult> {
    return this._client.createSession.mutate(options) as Promise<IRemoteSessionCreateResult>;
  }

  async closeSession(sessionId: string): Promise<void> {
    await this._client.closeSession.mutate(sessionId);
  }

  async write(sessionId: string, data: string | Uint8Array): Promise<void> {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    await this._client.write.mutate({ sessionId, dataB64: globalThis.btoa(binary) });
  }

  async resize(sessionId: string, rows: number, cols: number): Promise<void> {
    await this._client.resize.mutate({ sessionId, rows, cols });
  }

  async sendControl(sessionId: string, message: object): Promise<void> {
    await this._client.sendControl.mutate({ sessionId, message: message as Record<string, unknown> });
  }
}
