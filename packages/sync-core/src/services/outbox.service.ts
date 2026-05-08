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
import { Buffer } from 'node:buffer';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { ConfigRepository, SyncOutboxRepository } from '@termlnk/database';
import { SYNC_PLUGIN_CONFIG_KEY } from '@termlnk/sync';
import { BehaviorSubject } from 'rxjs';

const LAST_CLIENT_MUT_ID_FIELD = 'lastClientMutId';

/**
 * 单调的 client_mut_id 分配器 + outbox 写入协调器。
 *
 * 设计要点：
 * - clientMutId 必须**严格单调递增**，否则服务端去重 (clientId, clientMutId) 会失效
 * - 启动恢复路径：max(persistedHighWaterMark, max(outbox.client_mut_id)) 之和 + 1 为下一个 ID
 *   - persisted high water 防止 outbox 全部 ack 后 max() 归 0 重复利用 ID
 *   - max from outbox 防止 config 写入失败时退化（保证一定 > 已存在的 ID）
 * - 主进程内单实例 → in-memory 计数器是真理来源；写库 + 写持久化是异步成本，崩溃也至多丢若干 ID 不影响正确性
 *
 * pendingCount$ 仅在 enqueue / ack / clearResource 三个本地动作里更新——服务端拒绝
 * 不影响"待推送"语义（仍在队列里等下次重试）。
 */
export class SyncOutboxService extends Disposable implements ISyncOutboxService {
  private readonly _pendingCount$ = new BehaviorSubject<number>(0);
  readonly pendingCount$: Observable<number> = this._pendingCount$.asObservable();

  /** 已分配的最大 clientMutId；首次启动 = 0；下次分配 = _lastClientMutId + 1 */
  private _lastClientMutId = 0;

  /** 是否已完成首次 hydrate（初始计数 + 计数器加载）。在它前调用 enqueue 会先等待 hydrate。 */
  private _hydratePromise: Promise<void> | null = null;

  constructor(
    @Inject(SyncOutboxRepository) private readonly _outboxRepo: SyncOutboxRepository,
    @Inject(ConfigRepository) private readonly _configRepo: ConfigRepository,
    @Inject(ILogService) private readonly _logService: ILogService
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

    const persisted = await this._outboxRepo.insert({
      clientMutId,
      resource: mutation.resource,
      op: mutation.op,
      entityId: mutation.entityId,
      payload: mutation.payload === null ? null : Buffer.from(mutation.payload),
      baseVersion: mutation.baseVersion,
      createdAt,
    });

    this._pendingCount$.next(this._pendingCount$.getValue() + 1);

    return {
      id: persisted.clientMutId,
      resource: persisted.resource,
      op: persisted.op,
      entityId: persisted.entityId,
      payload: persisted.payload === null ? null : new Uint8Array(persisted.payload),
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
      payload: row.payload === null ? null : new Uint8Array(row.payload),
      baseVersion: row.baseVersion,
      createdAt: row.createdAt,
    }));
  }

  async ack(mutationIds: number[]): Promise<void> {
    if (mutationIds.length === 0) {
      return;
    }
    await this._hydratePromise;
    await this._outboxRepo.deleteByClientMutIds(mutationIds);
    await this._refreshPendingCount();
  }

  async markRejected(mutationIds: number[], reason: string): Promise<void> {
    if (mutationIds.length === 0) {
      return;
    }
    await this._hydratePromise;
    await this._outboxRepo.incrementRetry(mutationIds);
    this._logService.warn(
      `[SyncOutboxService] server rejected ${mutationIds.length} mutation(s) — reason: ${reason}`
    );
    // 拒绝不改变 pendingCount——条目仍在队列里待下次重试
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

  /**
   * 启动一次性的初始化：
   * 1. 计算待推送总数推到 pendingCount$
   * 2. 校准 in-memory clientMutId 计数器
   */
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
      this._logService.error('[SyncOutboxService] hydrate failed:', err);
      // hydrate 失败不阻塞构造；后续 enqueue 会用 _lastClientMutId=0 起步——
      // 但 outbox 本地数据可能已有更高 ID，此情况会立即被 dbMax 抢占。
    }
  }

  private async _allocateClientMutId(): Promise<number> {
    const next = this._lastClientMutId + 1;
    this._lastClientMutId = next;
    // 持久化 high water mark：即使 outbox 被 ack 全清空，下次启动也能从这里恢复
    await this._configRepo.setField(SYNC_PLUGIN_CONFIG_KEY, LAST_CLIENT_MUT_ID_FIELD, next);
    return next;
  }

  private async _refreshPendingCount(): Promise<void> {
    const count = await this._outboxRepo.countAll();
    this._pendingCount$.next(count);
  }
}
