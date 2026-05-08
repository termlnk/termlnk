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

import type { SyncResourceId } from '@termlnk/sync';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../entities';
import type { ISyncOutboxEntity, ISyncOutboxEntityInsert } from '../entities/sync-outbox';
import { Disposable } from '@termlnk/core';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { generateId } from '../entities/base';
import { syncOutboxEntity } from '../entities/sync-outbox';
import { IDBAdaptorService } from '../services/db-adaptor.service';

/**
 * sync_outbox 表数据访问层。
 *
 * 纯 CRUD——不做任何业务编排（不做 clientMutId 分配、不做 changed$ 通知 / 重试节奏）。
 * 那些职责在 SyncOutboxService（@termlnk/sync-core）。
 */
export class SyncOutboxRepository extends Disposable {
  constructor(
    @IDBAdaptorService private readonly _dbService: IDBAdaptorService
  ) {
    super();
  }

  private get _db() {
    return this._dbService.db as BetterSQLite3Database<typeof schema>;
  }

  /**
   * 持久化一条 mutation。`id` 由仓库分配（业务无关的 PK）；调用方传 clientMutId / 其他字段。
   * 返回完整持久化记录。
   */
  async insert(record: Omit<ISyncOutboxEntityInsert, 'id'> & { id?: string }): Promise<ISyncOutboxEntity> {
    const id = record.id ?? generateId();
    const inserted = await this._db
      .insert(syncOutboxEntity)
      .values({ ...record, id })
      .returning();
    return inserted[0];
  }

  /**
   * FIFO 取出待推送 mutation：按 createdAt 升序、tie-break by clientMutId。
   * 不删除（必须等待 ack 后才能删）。
   */
  async selectFifo(limit?: number): Promise<ISyncOutboxEntity[]> {
    const query = this._db
      .select()
      .from(syncOutboxEntity)
      .orderBy(asc(syncOutboxEntity.createdAt), asc(syncOutboxEntity.clientMutId));
    return limit && limit > 0 ? query.limit(limit) : query;
  }

  /** 服务端确认接收后删除——按 clientMutId 列表批量删。 */
  async deleteByClientMutIds(clientMutIds: number[]): Promise<void> {
    if (clientMutIds.length === 0) {
      return;
    }
    await this._db
      .delete(syncOutboxEntity)
      .where(inArray(syncOutboxEntity.clientMutId, clientMutIds));
  }

  /** 服务端拒绝时累加 retry_count（不删除）。 */
  async incrementRetry(clientMutIds: number[]): Promise<void> {
    if (clientMutIds.length === 0) {
      return;
    }
    await this._db
      .update(syncOutboxEntity)
      .set({ retryCount: sql`${syncOutboxEntity.retryCount} + 1` })
      .where(inArray(syncOutboxEntity.clientMutId, clientMutIds));
  }

  async countAll(): Promise<number> {
    const rows = await this._db
      .select({ count: sql<number>`count(*)` })
      .from(syncOutboxEntity);
    return rows[0]?.count ?? 0;
  }

  async countByResource(resource: SyncResourceId): Promise<number> {
    const rows = await this._db
      .select({ count: sql<number>`count(*)` })
      .from(syncOutboxEntity)
      .where(eq(syncOutboxEntity.resource, resource));
    return rows[0]?.count ?? 0;
  }

  async deleteByResource(resource: SyncResourceId): Promise<void> {
    await this._db
      .delete(syncOutboxEntity)
      .where(eq(syncOutboxEntity.resource, resource));
  }

  /**
   * 取出最大的 client_mut_id；启动恢复时辅助 SyncOutboxService 校准 in-memory 计数器。
   * 表空时返回 0。
   */
  async maxClientMutId(): Promise<number> {
    const rows = await this._db
      .select({ max: sql<number | null>`max(${syncOutboxEntity.clientMutId})` })
      .from(syncOutboxEntity);
    return rows[0]?.max ?? 0;
  }
}
