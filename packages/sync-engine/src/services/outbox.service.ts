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

import type { ISyncMutation, ISyncOutboxService, SyncResourceId } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import { Disposable, ILogService } from '@termlnk/core';
import { ISyncConfigRepository, ISyncOutboxRepository, SYNC_PLUGIN_CONFIG_KEY } from '@termlnk/sync';
import { BehaviorSubject } from 'rxjs';

const LAST_CLIENT_MUT_ID_FIELD = 'lastClientMutId';

// `clientMutId` must be strictly monotonic or the server's (clientId, clientMutId)
// dedupe breaks. Startup recovery uses max(persistedHighWater, max(outbox)) so an
// empty outbox cannot reset the sequence and a lost config write cannot reuse ids.
// Server rejection leaves the row in place for retry, so pendingCount$ moves only on
// enqueue / ack / clearResource.
export class SyncOutboxService extends Disposable implements ISyncOutboxService {
  private readonly _pendingCount$ = new BehaviorSubject<number>(0);
  readonly pendingCount$: Observable<number> = this._pendingCount$.asObservable();

  private _lastClientMutId = 0;

  // Enqueues await this so the in-memory counter has caught up with persisted state.
  private _hydratePromise: Promise<void> | null = null;

  constructor(
    @ISyncOutboxRepository private readonly _outboxRepo: ISyncOutboxRepository,
    @ISyncConfigRepository private readonly _configRepo: ISyncConfigRepository,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
    this._hydratePromise = this._hydrate();
  }

  override dispose(): void {
    this._pendingCount$.complete();
    super.dispose();
  }

  async enqueue(mutation: Omit<ISyncMutation, 'id' | 'createdAt'>): Promise<ISyncMutation> {
    await this._hydratePromise;

    const clientMutId = await this._allocateClientMutId();
    const createdAt = Date.now();

    // The outbox holds the latest pending state per (resource, entityId), not an op log.
    // Collapsing a superseded row stops stacked local edits from piling up and
    // self-conflicting on baseVersion during push (they all carry the same stale version
    // until the first one acks).
    const superseded = await this._outboxRepo.deleteByResourceAndEntityId(mutation.resource, mutation.entityId);

    const persisted = await this._outboxRepo.insert({
      clientMutId,
      resource: mutation.resource,
      op: mutation.op,
      entityId: mutation.entityId,
      payload: mutation.payload,
      baseVersion: mutation.baseVersion,
      createdAt,
    });

    this._pendingCount$.next(this._pendingCount$.getValue() + 1 - superseded);

    return {
      id: persisted.clientMutId,
      resource: persisted.resource,
      op: persisted.op,
      entityId: persisted.entityId,
      payload: persisted.payload,
      baseVersion: persisted.baseVersion,
      createdAt: persisted.createdAt,
    };
  }

  async peek(limit?: number): Promise<ISyncMutation[]> {
    await this._hydratePromise;
    const rows = await this._outboxRepo.selectFifo(limit);
    return rows.map((row) => ({
      id: row.clientMutId,
      resource: row.resource,
      op: row.op,
      entityId: row.entityId,
      payload: row.payload,
      baseVersion: row.baseVersion,
      createdAt: row.createdAt,
    }));
  }

  async ack(mutationIds: number[]): Promise<void> {
    if (mutationIds.length === 0) {
      return;
    }
    await this._hydratePromise;
    await this._deleteAndRefresh(mutationIds);
  }

  async markRejected(mutationIds: number[], reason: string): Promise<Map<number, number>> {
    if (mutationIds.length === 0) {
      return new Map();
    }
    await this._hydratePromise;
    const updated = await this._outboxRepo.incrementRetry(mutationIds);
    this._logService.warn(
      `[SyncOutboxService] server rejected ${mutationIds.length} mutation(s) — reason: ${reason}`
    );
    // Rejection does not change `pendingCount` — the row stays for retry.
    return new Map(updated.map((r) => [r.clientMutId, r.retryCount]));
  }

  async updateBaseVersion(mutationId: number, baseVersion: number): Promise<void> {
    await this._hydratePromise;
    // pendingCount is unchanged — the row stays queued, only its baseVersion is rebased.
    await this._outboxRepo.updateBaseVersion(mutationId, baseVersion);
  }

  async discard(mutationIds: number[]): Promise<void> {
    if (mutationIds.length === 0) {
      return;
    }
    await this._hydratePromise;
    await this._deleteAndRefresh(mutationIds);
  }

  async countByResource(resource: SyncResourceId): Promise<number> {
    await this._hydratePromise;
    return this._outboxRepo.countByResource(resource);
  }

  async clearResource(resource: SyncResourceId): Promise<void> {
    await this._hydratePromise;
    await this._outboxRepo.deleteByResource(resource);
    await this._refreshPendingCount();
  }

  async purgeByEntityIdPrefixes(resource: SyncResourceId, prefixes: readonly string[]): Promise<number> {
    if (prefixes.length === 0) {
      return 0;
    }
    await this._hydratePromise;
    const deleted = await this._outboxRepo.deleteByResourceAndEntityIdPrefixes(resource, prefixes);
    if (deleted > 0) {
      await this._refreshPendingCount();
    }
    return deleted;
  }

  private async _hydrate(): Promise<void> {
    try {
      const [count, persistedHighWater, dbMax] = await Promise.all([
        this._outboxRepo.countAll(),
        this._configRepo.getField<number>(SYNC_PLUGIN_CONFIG_KEY, LAST_CLIENT_MUT_ID_FIELD),
        this._outboxRepo.maxClientMutId(),
      ]);

      this._lastClientMutId = Math.max(persistedHighWater ?? 0, dbMax);
      this._pendingCount$.next(count);
    } catch (err) {
      // Non-fatal: construction proceeds with _lastClientMutId = 0. If the outbox
      // already holds higher ids, the next hydrate run will overtake via dbMax.
      this._logService.error('[SyncOutboxService] hydrate failed:', err);
    }
  }

  private async _allocateClientMutId(): Promise<number> {
    const next = this._lastClientMutId + 1;
    this._lastClientMutId = next;
    // Persist the high-water mark so the sequence survives an outbox fully drained by ack.
    await this._configRepo.setField(SYNC_PLUGIN_CONFIG_KEY, LAST_CLIENT_MUT_ID_FIELD, next);
    return next;
  }

  private async _deleteAndRefresh(mutationIds: number[]): Promise<void> {
    await this._outboxRepo.deleteByClientMutIds(mutationIds);
    await this._refreshPendingCount();
  }

  private async _refreshPendingCount(): Promise<void> {
    const count = await this._outboxRepo.countAll();
    this._pendingCount$.next(count);
  }
}
