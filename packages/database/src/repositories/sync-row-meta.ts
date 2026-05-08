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
import type { ISyncRowMetaEntity } from '../entities/sync-row-meta';
import { Disposable } from '@termlnk/core';
import { and, eq } from 'drizzle-orm';
import { syncRowMetaEntity } from '../entities/sync-row-meta';
import { IDBAdaptorService } from '../services/db-adaptor.service';

/**
 * 行级同步元数据仓库——纯 CRUD。
 *
 * 业务编排（"baseVersion 取自这里、应用 patch 时写回"）由 Synchroniser 负责。
 * 仓库本身只暴露读、upsert、删除操作。
 */
export class SyncRowMetaRepository extends Disposable {
  constructor(
    @IDBAdaptorService private readonly _dbService: IDBAdaptorService
  ) {
    super();
  }

  private get _db() {
    return this._dbService.db as BetterSQLite3Database<typeof schema>;
  }

  async get(resource: SyncResourceId, entityId: string): Promise<ISyncRowMetaEntity | null> {
    const rows = await this._db
      .select()
      .from(syncRowMetaEntity)
      .where(and(eq(syncRowMetaEntity.resource, resource), eq(syncRowMetaEntity.entityId, entityId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async getAll(resource: SyncResourceId): Promise<ISyncRowMetaEntity[]> {
    return this._db
      .select()
      .from(syncRowMetaEntity)
      .where(eq(syncRowMetaEntity.resource, resource));
  }

  async upsert(meta: ISyncRowMetaEntity): Promise<void> {
    await this._db
      .insert(syncRowMetaEntity)
      .values(meta)
      .onConflictDoUpdate({
        target: [syncRowMetaEntity.resource, syncRowMetaEntity.entityId],
        set: { version: meta.version, updatedAt: meta.updatedAt },
      });
  }

  async delete(resource: SyncResourceId, entityId: string): Promise<void> {
    await this._db
      .delete(syncRowMetaEntity)
      .where(and(eq(syncRowMetaEntity.resource, resource), eq(syncRowMetaEntity.entityId, entityId)));
  }

  async deleteResource(resource: SyncResourceId): Promise<void> {
    await this._db
      .delete(syncRowMetaEntity)
      .where(eq(syncRowMetaEntity.resource, resource));
  }
}
