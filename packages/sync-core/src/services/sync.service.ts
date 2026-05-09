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

import type { IDisposable } from '@termlnk/core';
import type { IResourceSynchroniser, IResourceSyncStats, ISyncError, ISyncOutboxService, ISyncService, ISyncStats, ISyncTransportService, SyncResourceId } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import { Disposable, generateRandomId, ILogService, Inject, toDisposable } from '@termlnk/core';
import { ConfigRepository, SyncCursorRepository } from '@termlnk/database';
import { ISyncOutboxService as ISyncOutboxServiceId, ISyncTransportService as ISyncTransportServiceId, SYNC_PLUGIN_CONFIG_KEY, SYNC_RESOURCES, SYNC_TRIGGER_INTERVALS, SynchroniserStatus, SyncState } from '@termlnk/sync';
import { BehaviorSubject, debounceTime, filter, interval, merge, Subject, Subscription } from 'rxjs';

const CLIENT_ID_FIELD = 'clientId';

// Top-level sync coordinator (main-process only). Registers ResourceSynchronisers and
// drives the push/pull/poke cadence:
//   - local change      -> debounce 500 ms -> push
//   - server poke       -> debounce 200 ms -> pull
//   - every 5 min       -> poll pull (catches silent WS drops)
//   - syncNow() / poke  -> push + pull immediately
// Out of scope: payload encryption (per-synchroniser via ISyncCryptoService), Repository
// writes (also per-synchroniser), token / reconnect handling (transport implementation).
//
// register() lives on the concrete class only; ISyncService consumers cannot reach it.
export class SyncService extends Disposable implements ISyncService {
  private readonly _state$ = new BehaviorSubject<SyncState>(SyncState.Disabled);
  readonly state$: Observable<SyncState> = this._state$.asObservable();

  private readonly _stats$ = new BehaviorSubject<ISyncStats>(this._emptyStats());
  readonly stats$: Observable<ISyncStats> = this._stats$.asObservable();

  private readonly _lastError$ = new BehaviorSubject<ISyncError | null>(null);
  readonly lastError$: Observable<ISyncError | null> = this._lastError$.asObservable();

  private readonly _enabled$ = new BehaviorSubject<boolean>(false);
  readonly enabled$: Observable<boolean> = this._enabled$.asObservable();

  // Indexed by resourceId so applyPatch can route incoming patches in O(1).
  private readonly _synchronisers: Map<SyncResourceId, IResourceSynchroniser> = new Map();

  // Subscriptions live only between enable() and disable().
  private _runtimeSub: Subscription | null = null;
  // Kept separate from _runtimeSub because we still want to observe reconnects after disable.
  private _transportSub: Subscription | null = null;

  // Per-device client id; loaded or generated at first enable().
  private _clientId: string | null = null;

  private readonly _pushTrigger$ = new Subject<void>();
  private readonly _pullTrigger$ = new Subject<void>();

  constructor(
    @Inject(ISyncOutboxServiceId) private readonly _outbox: ISyncOutboxService,
    @Inject(ISyncTransportServiceId) private readonly _transport: ISyncTransportService,
    @Inject(SyncCursorRepository) private readonly _cursors: SyncCursorRepository,
    @Inject(ConfigRepository) private readonly _configRepo: ConfigRepository,
    @Inject(ILogService) private readonly _logService: ILogService
  ) {
    super();
  }

  override dispose(): void {
    this._runtimeSub?.unsubscribe();
    this._transportSub?.unsubscribe();
    for (const s of this._synchronisers.values()) {
      s.dispose();
    }
    this._synchronisers.clear();
    this._state$.complete();
    this._stats$.complete();
    this._lastError$.complete();
    this._enabled$.complete();
    this._pushTrigger$.complete();
    this._pullTrigger$.complete();
    super.dispose();
  }

  // Registers a synchroniser; returns an IDisposable for explicit unregistration.
  // Production flows rely on the plugin dispose chain; tests use the disposable directly.
  register(synchroniser: IResourceSynchroniser): IDisposable {
    const existing = this._synchronisers.get(synchroniser.resourceId);
    if (existing) {
      throw new Error(`[SyncService] resource ${synchroniser.resourceId} is already registered`);
    }
    this._synchronisers.set(synchroniser.resourceId, synchroniser);

    return toDisposable(() => {
      this._synchronisers.delete(synchroniser.resourceId);
    });
  }

  async enable(): Promise<void> {
    if (this._enabled$.getValue()) {
      return;
    }
    this._lastError$.next(null);
    this._state$.next(SyncState.Idle);
    this._enabled$.next(true);

    for (const s of this._synchronisers.values()) {
      s.start();
    }
    this._clientId = await this._loadOrCreateClientId();

    // Disconnect -> Offline; reconnect -> Idle + immediate pull.
    this._transportSub = this._transport.connected$.subscribe((isConnected) => {
      if (!this._enabled$.getValue()) {
        return;
      }
      if (!isConnected) {
        this._state$.next(SyncState.Offline);
        return;
      }
      this._state$.next(SyncState.Idle);
      this._pullTrigger$.next();
    });

    // Wire triggers before connect() so the immediate pull driven by connected$ is not lost.
    this._runtimeSub = new Subscription();
    this._runtimeSub.add(
      this._outbox.pendingCount$.pipe(
        filter((n) => n > 0),
        debounceTime(SYNC_TRIGGER_INTERVALS.pushDebounceMs)
      ).subscribe(() => {
        void this._runPush();
      })
    );
    this._runtimeSub.add(
      this._pushTrigger$.subscribe(() => {
        void this._runPush();
      })
    );
    this._runtimeSub.add(
      merge(
        this._transport.poke$.pipe(debounceTime(SYNC_TRIGGER_INTERVALS.pullDebounceMs)),
        this._pullTrigger$,
        interval(SYNC_TRIGGER_INTERVALS.pollIntervalMs)
      ).subscribe(() => {
        void this._runPull();
      })
    );

    // Connect failures fall through to Offline; do not throw.
    // The initial pull is triggered by transportSub when connected$ flips true; an explicit
    // trigger here would double-fire.
    try {
      await this._transport.connect();
    } catch (err) {
      this._logService.warn('[SyncService] transport connect failed:', err);
      this._state$.next(SyncState.Offline);
    }
  }

  async disable(): Promise<void> {
    if (!this._enabled$.getValue()) {
      return;
    }
    this._enabled$.next(false);
    this._runtimeSub?.unsubscribe();
    this._runtimeSub = null;
    this._transportSub?.unsubscribe();
    this._transportSub = null;
    try {
      await this._transport.disconnect();
    } catch (err) {
      this._logService.warn('[SyncService] transport disconnect failed:', err);
    }
    this._state$.next(SyncState.Disabled);
  }

  async syncNow(): Promise<void> {
    if (!this._enabled$.getValue()) {
      return;
    }
    this._pushTrigger$.next();
    this._pullTrigger$.next();
  }

  async forceFullResync(): Promise<void> {
    if (!this._enabled$.getValue()) {
      return;
    }
    // Clearing every cursor makes the next pull restart from the beginning.
    for (const resource of SYNC_RESOURCES) {
      await this._cursors.delete(resource);
    }
    this._pullTrigger$.next();
  }

  private async _runPush(): Promise<void> {
    if (!this._enabled$.getValue() || !this._clientId) {
      return;
    }
    try {
      this._state$.next(SyncState.Syncing);
      const mutations = await this._outbox.peek();
      if (mutations.length === 0) {
        this._state$.next(SyncState.Idle);
        return;
      }
      const resp = await this._transport.push({ clientId: this._clientId, mutations });
      if (resp.accepted.length > 0) {
        await this._outbox.ack([...resp.accepted]);
      }
      if (resp.rejected.length > 0) {
        const rejectedIds = resp.rejected.map((r) => r.id);
        const reason = resp.rejected.map((r) => `${r.id}:${r.reason}`).join(';');
        await this._outbox.markRejected(rejectedIds, reason);
        // Rejections almost always mean a baseVersion conflict; pull first so the next
        // push is built against the latest state.
        this._pullTrigger$.next();
      }
      this._state$.next(SyncState.Idle);
    } catch (err) {
      this._reportError('network', `push failed: ${(err as Error).message}`);
    } finally {
      await this._refreshStats();
    }
  }

  private async _runPull(): Promise<void> {
    if (!this._enabled$.getValue() || !this._clientId) {
      return;
    }
    try {
      this._state$.next(SyncState.Syncing);
      for (const resource of SYNC_RESOURCES) {
        const synchroniser = this._synchronisers.get(resource);
        if (!synchroniser) {
          continue;
        }
        const cursorRow = await this._cursors.get(resource);
        const resp = await this._transport.pull({
          clientId: this._clientId,
          resource,
          cursor: cursorRow?.cursor ?? null,
        });
        if (resp.patch.length > 0) {
          await synchroniser.applyPatch([...resp.patch]);
        }
        if (resp.lastMutationId > 0) {
          // Backstop ack: push.accepted has usually cleared the outbox already, but if
          // we crashed mid-push this keeps the outbox in sync with what the server has.
          await this._outbox.ack([resp.lastMutationId]);
        }
        await this._cursors.upsert({
          resource,
          cursor: resp.cursor,
          lastPulledAt: Date.now(),
        });
      }
      this._state$.next(SyncState.Idle);
    } catch (err) {
      this._reportError('network', `pull failed: ${(err as Error).message}`);
    } finally {
      await this._refreshStats();
    }
  }

  private _reportError(code: ISyncError['code'], message: string): void {
    this._logService.error(`[SyncService] ${code}: ${message}`);
    this._lastError$.next({ code, message });
    this._state$.next(SyncState.Error);
  }

  private async _refreshStats(): Promise<void> {
    const perResource = {} as Record<SyncResourceId, IResourceSyncStats>;
    let pendingTotal = 0;
    let latestSyncedAt: number | null = null;

    for (const resource of SYNC_RESOURCES) {
      const cursor = await this._cursors.get(resource);
      const pending = await this._outbox.countByResource(resource);
      pendingTotal += pending;
      const syncer = this._synchronisers.get(resource);
      perResource[resource] = {
        status: syncer ? SynchroniserStatus.Idle : SynchroniserStatus.Idle,
        pendingCount: pending,
        lastSyncedAt: cursor?.lastPulledAt ?? null,
        cursor: cursor?.cursor ?? null,
      };
      if (cursor && (latestSyncedAt === null || cursor.lastPulledAt > latestSyncedAt)) {
        latestSyncedAt = cursor.lastPulledAt;
      }
    }

    this._stats$.next({
      pendingMutations: pendingTotal,
      lastSyncedAt: latestSyncedAt,
      perResource,
    });
  }

  private _emptyStats(): ISyncStats {
    const perResource = {} as Record<SyncResourceId, IResourceSyncStats>;
    for (const resource of SYNC_RESOURCES) {
      perResource[resource] = {
        status: SynchroniserStatus.Idle,
        pendingCount: 0,
        lastSyncedAt: null,
        cursor: null,
      };
    }
    return {
      pendingMutations: 0,
      lastSyncedAt: null,
      perResource,
    };
  }

  private async _loadOrCreateClientId(): Promise<string> {
    const existing = await this._configRepo.getField<string>(SYNC_PLUGIN_CONFIG_KEY, CLIENT_ID_FIELD);
    if (existing) {
      return existing;
    }
    const fresh = generateRandomId(24);
    await this._configRepo.setField(SYNC_PLUGIN_CONFIG_KEY, CLIENT_ID_FIELD, fresh);
    return fresh;
  }
}
