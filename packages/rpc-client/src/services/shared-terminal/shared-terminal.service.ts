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

import type { ClientConnectionState, ICollabInvite, IDriverState, IInviteClaimResult, IInviteCreateOptions, IInviteTokenState, IPairedDevice, IParticipant, IParticipantConnectResult, IParticipantFrame, IParticipantSessionMetadata, IParticipantSnapshot, IRemoteAnnouncedSession, IShareableSession, ISharedSession, ISharedTerminalService } from '@termlnk/shared-terminal';
import type { Observable } from 'rxjs';
import { Disposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { share, shareReplay } from 'rxjs';
import { IRPCClientService } from '../rpc-client.service';

/**
 * Renderer-side facade over the tRPC multiplayer router.
 *
 * shareReplay(1) wraps every multi-consumer observable so the UI tree can subscribe
 * from N components without spawning N tRPC subscriptions to the main process.
 */
export class SharedTerminalService extends Disposable implements ISharedTerminalService {
  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();
    // Drop per-sid observable cache entries when the main process retires the
    // session. Without this the caches grow with every join+disconnect cycle.
    // The subscription is owned by the service lifetime; participantSessions$
    // is shareReplay'd so this doesn't open an extra tRPC subscription.
    this.disposeWithMe(
      this.participantSessions$.subscribe((sessions) => {
        const alive = new Set(sessions);
        this._pruneCache(this._stateCache, alive);
        this._pruneCache(this._framesCache, alive);
        this._pruneCache(this._snapshotCache, alive);
        this._pruneCache(this._lastErrorCache, alive);
        this._pruneCache(this._connectionIdCache, alive);
        this._pruneCache(this._metadataCache, alive);
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
    return this._rpcClientService.getClient().multiplayer;
  }

  readonly sessions$: Observable<readonly ISharedSession[]> = trpcSubscriptionToObservable<readonly ISharedSession[]>(
    (opts) => this._client.sessions$.subscribe(undefined, opts)
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  async listSessions(): Promise<readonly ISharedSession[]> {
    return this._client.listSessions.query() as Promise<readonly ISharedSession[]>;
  }

  participants$(sessionId: string): Observable<readonly IParticipant[]> {
    return trpcSubscriptionToObservable<readonly IParticipant[]>(
      (opts) => this._client.participants$.subscribe(sessionId, opts)
    );
  }

  driverState$(sessionId: string): Observable<IDriverState> {
    return trpcSubscriptionToObservable<IDriverState>(
      (opts) => this._client.driverState$.subscribe(sessionId, opts)
    );
  }

  async setDriver(sessionId: string, clientId: string | null): Promise<void> {
    await this._client.setDriver.mutate({ sessionId, clientId });
  }

  async lockDriver(sessionId: string, clientId: string): Promise<void> {
    await this._client.lockDriver.mutate({ sessionId, clientId });
  }

  async unlockDriver(sessionId: string): Promise<void> {
    await this._client.unlockDriver.mutate(sessionId);
  }

  async kick(sessionId: string, clientId: string, reason?: string): Promise<void> {
    await this._client.kick.mutate({ sessionId, clientId, reason });
  }

  readonly outstandingInvites$: Observable<readonly IInviteTokenState[]> = trpcSubscriptionToObservable<readonly IInviteTokenState[]>(
    (opts) => this._client.outstandingInvites$.subscribe(undefined, opts)
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  readonly inviteHistory$: Observable<readonly IInviteTokenState[]> = trpcSubscriptionToObservable<readonly IInviteTokenState[]>(
    (opts) => this._client.inviteHistory$.subscribe(undefined, opts)
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  readonly inviteClaims$: Observable<IInviteClaimResult> = trpcSubscriptionToObservable<IInviteClaimResult>(
    (opts) => this._client.inviteClaims$.subscribe(undefined, opts)
  );

  async createInvite(options: IInviteCreateOptions): Promise<{ invite: ICollabInvite; url: string }> {
    return this._client.createInvite.mutate(options) as Promise<{ invite: ICollabInvite; url: string }>;
  }

  async revokeInvite(inviteId: string): Promise<void> {
    await this._client.revokeInvite.mutate(inviteId);
  }

  async listInvites(): Promise<readonly IInviteTokenState[]> {
    return this._client.listInvites.query() as Promise<readonly IInviteTokenState[]>;
  }

  readonly pairedDevices$: Observable<readonly IPairedDevice[]> = trpcSubscriptionToObservable<readonly IPairedDevice[]>(
    (opts) => this._client.pairedDevices$.subscribe(undefined, opts)
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  async revokeDevice(deviceId: string): Promise<void> {
    await this._client.revokeDevice.mutate(deviceId);
  }

  readonly shareable$: Observable<readonly IShareableSession[]> = trpcSubscriptionToObservable<readonly IShareableSession[]>(
    (opts) => this._client.shareable$.subscribe(undefined, opts)
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  async listShareable(): Promise<readonly IShareableSession[]> {
    return this._client.listShareable.query() as Promise<readonly IShareableSession[]>;
  }

  async shareSshSession(sessionId: string): Promise<void> {
    await this._client.shareSshSession.mutate(sessionId);
  }

  async sharePtySession(sessionId: string): Promise<void> {
    await this._client.sharePtySession.mutate(sessionId);
  }

  async stopSharing(sessionId: string): Promise<void> {
    await this._client.stopSharing.mutate(sessionId);
  }

  readonly inviteUrl$: Observable<string> = trpcSubscriptionToObservable<string>(
    (opts) => this._client.inviteUrl$.subscribe(undefined, opts)
  );

  readonly participantSessions$: Observable<readonly string[]> = trpcSubscriptionToObservable<readonly string[]>(
    (opts) => this._client.participantSessions$.subscribe(undefined, opts)
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  /**
   * Per-sid observable caches: a tab's RemoteTerminalView and the
   * RemoteSessionBridgeController both subscribe to the same state/snapshot/
   * connectionId/lastError/metadata streams. Without caching, every consumer
   * would open an independent tRPC subscription over Electron IPC, doubling
   * traffic per stream. `shareReplay({bufferSize:1, refCount:true})` keeps
   * one upstream subscription alive while ≥1 downstream is subscribed and
   * replays the latest value to new subscribers.
   *
   * `participantFrames$` intentionally uses `share()` (no replay): replaying
   * old PtyData bytes to a fresh subscriber would re-write characters that
   * the snapshot has already covered.
   */
  private readonly _stateCache = new Map<string, Observable<ClientConnectionState>>();
  private readonly _framesCache = new Map<string, Observable<IParticipantFrame>>();
  private readonly _snapshotCache = new Map<string, Observable<IParticipantSnapshot | null>>();
  private readonly _lastErrorCache = new Map<string, Observable<string | null>>();
  private readonly _connectionIdCache = new Map<string, Observable<string | null>>();
  private readonly _metadataCache = new Map<string, Observable<IParticipantSessionMetadata | null>>();

  participantState$(sessionId: string): Observable<ClientConnectionState> {
    let cached = this._stateCache.get(sessionId);
    if (!cached) {
      cached = trpcSubscriptionToObservable<ClientConnectionState>(
        (opts) => this._client.participantState$.subscribe(sessionId, opts)
      ).pipe(shareReplay({ bufferSize: 1, refCount: true }));
      this._stateCache.set(sessionId, cached);
    }
    return cached;
  }

  participantFrames$(sessionId: string): Observable<IParticipantFrame> {
    let cached = this._framesCache.get(sessionId);
    if (!cached) {
      cached = trpcSubscriptionToObservable<IParticipantFrame>(
        (opts) => this._client.participantFrames$.subscribe(sessionId, opts)
      ).pipe(share());
      this._framesCache.set(sessionId, cached);
    }
    return cached;
  }

  participantSnapshot$(sessionId: string): Observable<IParticipantSnapshot | null> {
    let cached = this._snapshotCache.get(sessionId);
    if (!cached) {
      cached = trpcSubscriptionToObservable<IParticipantSnapshot | null>(
        (opts) => this._client.participantSnapshot$.subscribe(sessionId, opts)
      ).pipe(shareReplay({ bufferSize: 1, refCount: true }));
      this._snapshotCache.set(sessionId, cached);
    }
    return cached;
  }

  participantLastError$(sessionId: string): Observable<string | null> {
    let cached = this._lastErrorCache.get(sessionId);
    if (!cached) {
      cached = trpcSubscriptionToObservable<string | null>(
        (opts) => this._client.participantLastError$.subscribe(sessionId, opts)
      ).pipe(shareReplay({ bufferSize: 1, refCount: true }));
      this._lastErrorCache.set(sessionId, cached);
    }
    return cached;
  }

  participantConnectionId$(sessionId: string): Observable<string | null> {
    let cached = this._connectionIdCache.get(sessionId);
    if (!cached) {
      cached = trpcSubscriptionToObservable<string | null>(
        (opts) => this._client.participantConnectionId$.subscribe(sessionId, opts)
      ).pipe(shareReplay({ bufferSize: 1, refCount: true }));
      this._connectionIdCache.set(sessionId, cached);
    }
    return cached;
  }

  participantMetadata$(sessionId: string): Observable<IParticipantSessionMetadata | null> {
    let cached = this._metadataCache.get(sessionId);
    if (!cached) {
      cached = trpcSubscriptionToObservable<IParticipantSessionMetadata | null>(
        (opts) => this._client.participantMetadata$.subscribe(sessionId, opts)
      ).pipe(shareReplay({ bufferSize: 1, refCount: true }));
      this._metadataCache.set(sessionId, cached);
    }
    return cached;
  }

  async connectAsParticipant(inviteUrl: string): Promise<IParticipantConnectResult> {
    return this._client.connectAsParticipant.mutate({ inviteUrl }) as Promise<IParticipantConnectResult>;
  }

  async disconnectParticipant(sessionId: string): Promise<void> {
    await this._client.disconnectParticipant.mutate(sessionId);
  }

  async sendParticipantInput(sessionId: string, data: Uint8Array): Promise<void> {
    // Defensive copy: `data` may be a typed-array sub-view with an offset; the
    // String.fromCharCode loop indexes by .length but a sub-view's underlying
    // buffer could be much larger. Copying into a fresh Uint8Array guarantees
    // every read is in-bounds and the bytes start at offset 0.
    const bytes = new Uint8Array(data);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    await this._client.sendParticipantInput.mutate({ sessionId, dataB64: globalThis.btoa(binary) });
  }

  async sendParticipantControl(sessionId: string, message: object): Promise<void> {
    await this._client.sendParticipantControl.mutate({ sessionId, message: message as Record<string, unknown> });
  }

  async setSharedSessionTitle(sessionId: string, title: string): Promise<void> {
    await this._client.setSharedSessionTitle.mutate({ sessionId, title });
  }

  readonly remoteSessions$: Observable<readonly IRemoteAnnouncedSession[]> = trpcSubscriptionToObservable<readonly IRemoteAnnouncedSession[]>(
    (opts) => this._client.remoteSessions$.subscribe(undefined, opts)
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  async listRemoteSessions(): Promise<readonly IRemoteAnnouncedSession[]> {
    return this._client.listRemoteSessions.query() as Promise<readonly IRemoteAnnouncedSession[]>;
  }

  async refreshRemoteSessions(): Promise<void> {
    await this._client.refreshRemoteSessions.mutate();
  }

  async announceDeviceSession(sessionId: string, title: string, cols: number, rows: number): Promise<void> {
    await this._client.announceDeviceSession.mutate({ sessionId, title, cols, rows });
  }

  async retractDeviceSession(sessionId: string): Promise<void> {
    await this._client.retractDeviceSession.mutate(sessionId);
  }
}
