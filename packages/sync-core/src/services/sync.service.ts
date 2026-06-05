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
import type { IResourceSynchroniser, IResourceSyncStats, ISyncError, ISyncMutation, ISyncService, ISyncStats, SyncResourceId } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import { Disposable, generateRandomId, ILogService, Inject, toDisposable } from '@termlnk/core';
import { ConfigRepository, SyncCursorRepository, SyncRowMetaRepository } from '@termlnk/database';
import { ISyncCryptoService, ISyncOutboxService, ISyncTransportService, NON_SYNCABLE_CONFIG_KEYS, SYNC_MAX_BASE_VERSION_RETRIES, SYNC_PLUGIN_CONFIG_KEY, SYNC_PUSH_BATCH_SIZE, SYNC_RESOURCES, SYNC_TRIGGER_INTERVALS, SYNC_USER_ENABLED_FIELD, SynchroniserStatus, SyncState } from '@termlnk/sync';
import { BehaviorSubject, debounceTime, distinctUntilChanged, filter, interval, merge, Subject, Subscription } from 'rxjs';

const CLIENT_ID_FIELD = 'clientId';

// `config` entityIds are `${key}::${subKey}`. Outbox rows under non-syncable plugin keys
// must never reach the server; purge them at first enable() on each process.
const CONFIG_GARBAGE_ENTITY_PREFIXES: readonly string[] = Array.from(NON_SYNCABLE_CONFIG_KEYS).map(
  (key) => `${key}::`
);

// Top-level sync coordinator. Registers ResourceSynchronisers and drives the
// push/pull/poke cadence.
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

  // Lives only between enable() and disable().
  private _runtimeSub: Subscription | null = null;
  // Kept separate so reconnects remain observable after disable.
  private _transportSub: Subscription | null = null;

  private _clientId: string | null = null;

  // Gates SyncState.Idle: a push-only success would otherwise light the "Up to date"
  // badge while stats.lastSyncedAt is still null/stale.
  private _initialPullDone = false;

  // After reconcile() has done its forced full pull, the transportSub's first
  // connected$ → true emission would otherwise trigger a redundant second pull (the cursor
  // is already at the server's tail). Set true at the end of reconcile() and consumed by
  // the connected$ handler on its first true emit. Subsequent reconnects (WS dropped and
  // came back) still pull, which is needed to catch up on anything missed while offline.
  private _skipFirstConnectPull = false;

  // Wall-clock of the most recent push round that drained the outbox to zero. Distinct
  // from lastSyncedAt (which reflects the latest pull). The UI uses both to tell whether
  // the user actually saw a successful round-trip — "Up to date" means both have advanced.
  private _lastPushedAt: number | null = null;

  // One-shot per process; subsequent sweeps would just be wasted disk I/O.
  private _garbagePurged = false;

  private readonly _pushTrigger$ = new Subject<void>();
  private readonly _pullTrigger$ = new Subject<void>();

  constructor(
    @ISyncOutboxService private readonly _outboxService: ISyncOutboxService,
    @ISyncTransportService private readonly _transportService: ISyncTransportService,
    @ISyncCryptoService private readonly _cryptoService: ISyncCryptoService,
    @Inject(SyncCursorRepository) private readonly _cursors: SyncCursorRepository,
    @Inject(ConfigRepository) private readonly _configRepo: ConfigRepository,
    @Inject(SyncRowMetaRepository) private readonly _rowMetaRepo: SyncRowMetaRepository,
    @ILogService private readonly _logService: ILogService
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

  // Production flows rely on the plugin dispose chain; the returned disposable is for tests.
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
    // Persist intent before runtime so AuthSyncBridgeController can restore the
    // toggle on next sign-in even if startup races never call enable() again.
    await this._configRepo.setField(SYNC_PLUGIN_CONFIG_KEY, SYNC_USER_ENABLED_FIELD, true);
    if (this._enabled$.getValue()) {
      return;
    }

    // Gate: crypto must be available before we start the pipeline. With a locked master key
    // every encrypt() would throw inside synchroniser code and the failures get caught by
    // local try/catch blocks — the pipeline would run but no mutation could ever leave the
    // device. Refuse to enable instead, and surface the canonical error code so the UI can
    // ask the user to sign in again.
    if (!this._cryptoService.available) {
      this._reportError(
        'master_key_locked',
        'Master key is locked; sign in again to enable sync.',
        { requiresUserAction: true }
      );
      return;
    }

    this._lastError$.next(null);
    this._initialPullDone = false;
    this._skipFirstConnectPull = false;
    this._lastPushedAt = null;
    this._state$.next(SyncState.Syncing);
    this._enabled$.next(true);

    // Bind the runtime Subscription locally so add() calls below see a non-nullable
    // type; the field is kept in sync so stopRuntime() can unsubscribe it.
    const runtimeSub = new Subscription();
    this._runtimeSub = runtimeSub;

    for (const s of this._synchronisers.values()) {
      s.start();
    }
    this._subscribeSynchroniserStatuses(runtimeSub);
    this._clientId = await this._loadOrCreateClientId();
    await this._purgeConfigGarbageOnce();
    // Reconcile *before* buildInitialSnapshot so that any "ghost meta" (local meta rows
    // pointing at server-side entityIds that no longer exist — e.g. after a cloud reset)
    // is cleared first. Without this, buildInitialSnapshot would skip those local rows
    // forever (its dedupe checks meta existence) and they would never reach the cloud.
    await this._reconcile();
    // Seed *after* reconcile so buildInitialSnapshot's "skip if meta exists" gate sees the
    // post-reconcile state. outbox.pendingCount$ is a BehaviorSubject and replays its
    // (now non-zero) value at subscribe time, so the first debounce window fires push.
    await this._seedInitialSnapshots();
    await this._refreshStats();

    this._transportSub = this._transportService.connected$.subscribe((isConnected) => {
      if (!this._enabled$.getValue()) {
        return;
      }
      if (!isConnected) {
        this._state$.next(SyncState.Offline);
        return;
      }
      if (this._skipFirstConnectPull) {
        // reconcile() in this enable() already did the initial full pull; flip straight
        // to Idle and skip the redundant connect-driven pull. Re-armed on every enable().
        this._skipFirstConnectPull = false;
        this._state$.next(SyncState.Idle);
        return;
      }
      this._state$.next(SyncState.Syncing);
      this._pullTrigger$.next();
    });

    // Wire triggers before connect() so the immediate pull driven by connected$ is not lost.
    runtimeSub.add(
      this._outboxService.pendingCount$.pipe(
        filter((n) => n > 0),
        debounceTime(SYNC_TRIGGER_INTERVALS.pushDebounceMs)
      ).subscribe(() => {
        void this._runPush();
      })
    );
    runtimeSub.add(
      this._pushTrigger$.subscribe(() => {
        void this._runPush();
      })
    );
    runtimeSub.add(
      merge(
        this._transportService.poke$.pipe(debounceTime(SYNC_TRIGGER_INTERVALS.pullDebounceMs)),
        this._pullTrigger$,
        interval(SYNC_TRIGGER_INTERVALS.pollIntervalMs)
      ).subscribe(() => {
        void this._runPull();
      })
    );

    // Initial pull is fired by transportSub when connected$ flips true; an explicit
    // trigger here would double-fire.
    try {
      await this._transportService.connect();
    } catch (err) {
      this._logService.warn('[SyncService] transport connect failed:', err);
      this._state$.next(SyncState.Offline);
    }
  }

  async disable(): Promise<void> {
    await this._configRepo.setField(SYNC_PLUGIN_CONFIG_KEY, SYNC_USER_ENABLED_FIELD, false);
    await this.stopRuntime();
  }

  // Sign-out path: tear down the pipeline but keep userEnabled intact so the next
  // sign-in auto-restores the toggle.
  async stopRuntime(): Promise<void> {
    if (!this._enabled$.getValue()) {
      return;
    }
    this._enabled$.next(false);
    this._initialPullDone = false;
    this._runtimeSub?.unsubscribe();
    this._runtimeSub = null;
    this._transportSub?.unsubscribe();
    this._transportSub = null;
    try {
      await this._transportService.disconnect();
    } catch (err) {
      this._logService.warn('[SyncService] transport disconnect failed:', err);
    }
    this._state$.next(SyncState.Disabled);
  }

  async syncNow(): Promise<void> {
    if (!this._enabled$.getValue()) {
      return;
    }
    // Manual retry clears the stale error banner; the next failure will repopulate it.
    this._lastError$.next(null);
    this._pushTrigger$.next();
    this._pullTrigger$.next();
  }

  async forceFullResync(): Promise<void> {
    if (!this._enabled$.getValue()) {
      return;
    }
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
      // Drain in fixed-size batches. Exit when the outbox empties or when no row in the
      // latest batch was accepted — the rejected rows still sit at the FIFO head; let the
      // next pull/push tick retry after baseVersion conflicts resolve.
      let drainedEmpty = false;
      let anyAccepted = false;
      while (this._enabled$.getValue()) {
        const mutations = await this._outboxService.peek(SYNC_PUSH_BATCH_SIZE);
        if (mutations.length === 0) {
          drainedEmpty = true;
          break;
        }
        const resp = await this._transportService.push({ clientId: this._clientId, mutations });

        // Write sync_row_meta first so that even if ack() later crashes, the meta still
        // reflects the server-assigned version. Idempotency on the synchroniser side
        // (per-resource upsert by entityId) makes a possible duplicate harmless.
        for (const detail of resp.acceptedDetails) {
          const synchroniser = this._synchronisers.get(detail.resource);
          if (!synchroniser) {
            continue;
          }
          try {
            await synchroniser.onPushAccepted(detail);
          } catch (err) {
            this._logService.warn(
              `[SyncService] onPushAccepted failed for ${detail.resource}/${detail.entityId}:`,
              err
            );
            // Don't break the ack loop — reconcile picks up missed meta on next enable().
          }
        }

        // Prefer the detailed list for ack so id ordering matches the meta writes above;
        // fall back to the legacy `accepted` array when the server hasn't shipped the new
        // protocol yet.
        const idsToAck = resp.acceptedDetails.length > 0
          ? resp.acceptedDetails.map((d) => d.id)
          : [...resp.accepted];
        if (idsToAck.length > 0) {
          await this._outboxService.ack(idsToAck);
          anyAccepted = true;
        }
        let rebased = 0;
        if (resp.rejected.length > 0) {
          const rejectedIds = resp.rejected.map((r) => r.id);
          const reason = resp.rejected.map((r) => `${r.id}:${r.reason}`).join(';');
          const retryCounts = await this._outboxService.markRejected(rejectedIds, reason);
          // Local-first: rebase rejected row-level mutations onto the latest server version so
          // the loop's next iteration retries them with a fresh baseVersion (serial, no re-entry).
          rebased = await this._rebaseRejectedMutations(mutations, retryCounts);
        }
        // No progress this round — nothing accepted and nothing left to retry.
        if (resp.accepted.length === 0 && rebased === 0) {
          break;
        }
      }
      // Mark the "outbox cleanly drained" wall-clock so the UI can distinguish "Up to
      // date" (push + pull both flowed) from "Pulled only" (never had local changes to
      // push, or push is still backed up).
      if (drainedEmpty && anyAccepted) {
        this._lastPushedAt = Date.now();
      }
      // refreshStats must precede the Idle emit so subscribers never observe
      // "Idle + stale lastSyncedAt" between two BehaviorSubject ticks.
      await this._refreshStats();
      this._lastError$.next(null);
      // Push success alone cannot prove "local matches remote" — wait for first pull.
      if (this._initialPullDone) {
        this._state$.next(SyncState.Idle);
      }
    } catch (err) {
      this._reportError('network', `push failed: ${(err as Error).message}`);
      await this._refreshStats();
    }
  }

  // Per-resource forced full pull (cursor=null) → apply patches → diff local meta against
  // server's authoritative entityId set → clear ghost meta. Runs once per enable(); the
  // network cost is one batch per resource and the data already needs to be on the device
  // for the first authoritative snapshot anyway. Failures are logged and skipped; we'd
  // rather start sync with partial reconciliation than block enable() outright.
  private async _reconcile(): Promise<void> {
    if (!this._clientId) {
      return;
    }
    let anyFailed = false;
    for (const resource of SYNC_RESOURCES) {
      const synchroniser = this._synchronisers.get(resource);
      if (!synchroniser) {
        continue;
      }
      try {
        // Force-full pull regardless of local cursor. Server returns every (put or del
        // tombstone) row at version > 0 for the user — i.e. the complete authoritative set.
        const fullPull = await this._transportService.pull({
          clientId: this._clientId,
          resource,
          cursor: null,
        });

        if (fullPull.patch.length > 0) {
          // Apply unconditionally: `put` rewrites the local row + writes meta;
          // `del` tombstones cascade through the synchroniser's repository (and clear meta
          // for that entityId). _applyingPatch flag in each synchroniser suppresses the
          // changed$ self-echo that would otherwise loop back into the outbox.
          await synchroniser.applyPatch([...fullPull.patch]);
        }

        // Authoritative server-side entityId set. Include both 'put' (still exists) and
        // 'del' (tombstone) — both states are server-authoritative; meta pointing at a
        // tombstone is fine because applyPatch already deleted the local row + meta. The
        // ghost case is entityIds entirely absent from the pull, which indicates server-
        // side wipe (e.g. dev reset of sync_objects).
        const serverEntityIds = new Set<string>();
        for (const item of fullPull.patch) {
          if (item.entityId !== null) {
            serverEntityIds.add(item.entityId);
          }
        }

        await synchroniser.reconcileGhostMeta(serverEntityIds);

        // Update cursor so the regular pull/poke loop continues from the latest position.
        await this._cursors.upsert({
          resource,
          cursor: fullPull.cursor,
          lastPulledAt: Date.now(),
        });
      } catch (err) {
        // Network down / decryption failure / repository write blew up — surface as a
        // lastError so the UI can show a banner. Don't abort enable(): the regular
        // connect-driven pull below will take over as the "first pull" attempt.
        anyFailed = true;
        this._logService.warn(`[SyncService] reconcile failed for ${resource}:`, err);
        this._reportError('network', `reconcile failed for ${resource}: ${(err as Error).message}`);
      }
    }
    // Only mark the initial pull complete + suppress the connect-driven follow-up if every
    // resource's reconcile succeeded. Partial failure means the transport-connected handler
    // must still drive a fresh pull to backfill — preserving the pre-reconcile invariant
    // "no push-only Idle before first pull".
    if (!anyFailed) {
      this._initialPullDone = true;
      this._skipFirstConnectPull = true;
    }
  }

  // Synchronisers gate their own emit by sync_row_meta / sync_field_meta, so this is a
  // cheap no-op once the first push round-trip has filled meta. Per-synchroniser failures
  // are logged and skipped: a half-seeded outbox still pushes what it has.
  private async _seedInitialSnapshots(): Promise<void> {
    for (const synchroniser of this._synchronisers.values()) {
      try {
        await synchroniser.buildInitialSnapshot();
      } catch (err) {
        this._logService.warn(
          `[SyncService] initial snapshot failed for resource ${synchroniser.resourceId}:`,
          err
        );
      }
    }
  }

  // Drops outbox rows whose entityId points at a non-syncable config key. Pushing them
  // upstream would waste bandwidth and pollute server-side history.
  private async _purgeConfigGarbageOnce(): Promise<void> {
    if (this._garbagePurged) {
      return;
    }
    this._garbagePurged = true;
    try {
      const deleted = await this._outboxService.purgeByEntityIdPrefixes('config', CONFIG_GARBAGE_ENTITY_PREFIXES);
      if (deleted > 0) {
        this._logService.log(`[SyncService] purged ${deleted} non-syncable config mutation(s) from outbox`);
      }
    } catch (err) {
      // Non-fatal: enable() proceeds. If purge keeps failing the user can hit Resync.
      this._logService.warn('[SyncService] failed to purge outbox garbage:', err);
    }
  }

  private async _runPull(): Promise<void> {
    if (!this._enabled$.getValue() || !this._clientId) {
      return;
    }
    try {
      this._state$.next(SyncState.Syncing);
      for (const resource of SYNC_RESOURCES) {
        await this._pullResource(resource);
      }
      // refreshStats must precede the Idle emit so subscribers never observe
      // "Idle + stale lastSyncedAt" between two BehaviorSubject ticks.
      await this._refreshStats();
      this._initialPullDone = true;
      this._lastError$.next(null);
      this._state$.next(SyncState.Idle);
    } catch (err) {
      this._reportError('network', `pull failed: ${(err as Error).message}`);
      await this._refreshStats();
    }
  }

  // Single-resource pull, shared by _runPull and the rebase path. Throws on transport/apply
  // failure so callers decide handling.
  private async _pullResource(resource: SyncResourceId): Promise<void> {
    const clientId = this._clientId;
    const synchroniser = this._synchronisers.get(resource);
    if (!clientId || !synchroniser) {
      return;
    }
    const cursorRow = await this._cursors.get(resource);
    const resp = await this._transportService.pull({
      clientId,
      resource,
      cursor: cursorRow?.cursor ?? null,
    });
    if (resp.patch.length > 0) {
      await synchroniser.applyPatch([...resp.patch]);
    }
    if (resp.lastMutationId > 0) {
      // Backstop ack: push.accepted has usually cleared the outbox already, but if
      // we crashed mid-push this keeps the outbox in sync with what the server has.
      await this._outboxService.ack([resp.lastMutationId]);
    }
    await this._cursors.upsert({
      resource,
      cursor: resp.cursor,
      lastPulledAt: Date.now(),
    });
  }

  // Local-first conflict resolution: keep each rejected mutation's payload (the local change)
  // and rebase its baseVersion onto the latest server version so the next push wins. Drop
  // mutations past the retry cap (yield to remote) or whose entity the server has deleted.
  private async _rebaseRejectedMutations(
    batch: ISyncMutation[],
    retryCounts: Map<number, number>
  ): Promise<number> {
    const rejectedMutations = batch.filter((m) => retryCounts.has(m.id));
    if (rejectedMutations.length === 0) {
      return 0;
    }

    // Refresh sync_row_meta / local rows for the affected resources before rebasing. A pull
    // failure is non-fatal: skip and let the next tick retry.
    const resources = new Set(rejectedMutations.map((m) => m.resource));
    for (const resource of resources) {
      try {
        await this._pullResource(resource);
      } catch (err) {
        this._logService.warn(`[SyncService] rebase pull failed for ${resource}:`, err);
        return 0;
      }
    }

    let rebasedCount = 0;
    for (const m of rejectedMutations) {
      // config (field-level LWW) carries no baseVersion; there is nothing to rebase.
      if (m.baseVersion === null) {
        continue;
      }
      const retryCount = retryCounts.get(m.id) ?? 0;
      if (retryCount > SYNC_MAX_BASE_VERSION_RETRIES) {
        this._logService.warn(
          `[SyncService] dropping stale mutation ${m.id} (${m.resource}/${m.entityId}) after ${retryCount} baseVersion conflicts`
        );
        await this._outboxService.discard([m.id]);
        continue;
      }
      const meta = await this._rowMetaRepo.get(m.resource, m.entityId);
      if (!meta) {
        // Server deleted this entity (the pull applied a del tombstone). Honour the
        // "delete wins" convention and drop the local mutation.
        this._logService.log(
          `[SyncService] dropping mutation ${m.id} for server-deleted ${m.resource}/${m.entityId}`
        );
        await this._outboxService.discard([m.id]);
        continue;
      }
      await this._outboxService.updateBaseVersion(m.id, meta.version);
      rebasedCount++;
    }
    return rebasedCount;
  }

  private _reportError(code: ISyncError['code'], message: string, extra?: Partial<Omit<ISyncError, 'code' | 'message'>>): void {
    this._logService.error(`[SyncService] ${code}: ${message}`);
    this._lastError$.next({ code, message, ...extra });
    this._state$.next(SyncState.Error);
  }

  // Translates SynchroniserStatus.CryptoLocked into a user-visible error. Without this,
  // synchroniser-level encrypt() failures would only show up in main-process logs.
  // The runtime Subscription is owned by enable(); stopRuntime() unsubscribes it.
  private _subscribeSynchroniserStatuses(runtimeSub: Subscription): void {
    for (const s of this._synchronisers.values()) {
      runtimeSub.add(
        s.status$.pipe(distinctUntilChanged()).subscribe((status) => {
          if (status === SynchroniserStatus.CryptoLocked) {
            this._reportError(
              'master_key_locked',
              'Sync paused: master key is locked. Please sign in again.',
              { requiresUserAction: true }
            );
          }
        })
      );
    }
  }

  private async _refreshStats(): Promise<void> {
    const perResource = {} as Record<SyncResourceId, IResourceSyncStats>;
    let pendingTotal = 0;
    let latestSyncedAt: number | null = null;

    for (const resource of SYNC_RESOURCES) {
      const cursor = await this._cursors.get(resource);
      const pending = await this._outboxService.countByResource(resource);
      pendingTotal += pending;
      perResource[resource] = {
        status: SynchroniserStatus.Idle,
        pendingCount: pending,
        lastSyncedAt: cursor?.lastPulledAt ?? null,
        cursor: cursor?.cursor ?? null,
      };
      if (cursor && (latestSyncedAt === null || cursor.lastPulledAt > latestSyncedAt)) {
        latestSyncedAt = cursor.lastPulledAt;
      }
    }

    // lastPushedAt advances whenever a push round leaves the outbox empty. Tracking it on
    // the service (rather than computing it here) avoids the false positive of "outbox is
    // empty because the user never queued anything" being read as "push succeeded".
    this._stats$.next({
      pendingMutations: pendingTotal,
      lastSyncedAt: latestSyncedAt,
      lastPushedAt: this._lastPushedAt,
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
      lastPushedAt: null,
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
