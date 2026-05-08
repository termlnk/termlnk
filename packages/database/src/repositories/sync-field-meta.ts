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
import type { ISyncFieldMetaEntity } from '../entities/sync-field-meta';
import { Disposable } from '@termlnk/core';
import { and, eq } from 'drizzle-orm';
import { syncFieldMetaEntity } from '../entities/sync-field-meta';
import { IDBAdaptorService } from '../services/db-adaptor.service';

/**
 * 字段级同步元数据仓库（仅 config 资源使用）。
 *
 * config.value 是嵌套 JSON——按行 LWW 会让两台设备相互覆写未变更的字段。
 * 因此 ConfigSynchroniser 给每个 (key, subKey) 单独维护 updatedAt 时间戳。
 */
export class SyncFieldMetaRepository extends Disposable {
  constructor(
    @IDBAdaptorService private readonly _dbService: IDBAdaptorService
  ) {
    super();
  }

  private get _db() {
    return this._dbService.db as BetterSQLite3Database<typeof schema>;
  }

  async get(resource: SyncResourceId, entityId: string, field: string): Promise<ISyncFieldMetaEntity | null> {
    const rows = await this._db
      .select()
      .from(syncFieldMetaEntity)
      .where(and(
        eq(syncFieldMetaEntity.resource, resource),
        eq(syncFieldMetaEntity.entityId, entityId),
        eq(syncFieldMetaEntity.field, field)
      ))
      .limit(1);
    return rows[0] ?? null;
  }

  async getByEntity(resource: SyncResourceId, entityId: string): Promise<ISyncFieldMetaEntity[]> {
    return this._db
      .select()
      .from(syncFieldMetaEntity)
      .where(and(eq(syncFieldMetaEntity.resource, resource), eq(syncFieldMetaEntity.entityId, entityId)));
  }

  async upsert(meta: ISyncFieldMetaEntity): Promise<void> {
    await this._db
      .insert(syncFieldMetaEntity)
      .values(meta)
      .onConflictDoUpdate({
        target: [syncFieldMetaEntity.resource, syncFieldMetaEntity.entityId, syncFieldMetaEntity.field],
        set: { updatedAt: meta.updatedAt },
      });
  }

  async delete(resource: SyncResourceId, entityId: string, field: string): Promise<void> {
    await this._db
      .delete(syncFieldMetaEntity)
      .where(and(
        eq(syncFieldMetaEntity.resource, resource),
        eq(syncFieldMetaEntity.entityId, entityId),
        eq(syncFieldMetaEntity.field, field)
      ));
  }

  async deleteResource(resource: SyncResourceId): Promise<void> {
    await this._db
      .delete(syncFieldMetaEntity)
      .where(eq(syncFieldMetaEntity.resource, resource));
  }
}
