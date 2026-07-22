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

import type { ISyncRowMetaRepository, SyncResourceId } from '@termlnk/sync';
import type { ISyncRowMetaEntity } from '../entities/sync-row-meta';
import { Disposable } from '@termlnk/core';
import { and, eq } from 'drizzle-orm';
import { syncRowMetaEntity } from '../entities/sync-row-meta';
import { IDBAdaptorService } from '../services/db-adaptor.service';

/**
 * Per-row sync metadata — pure CRUD.
 *
 * Business orchestration ("read `baseVersion` here, write it back after
 * applying a patch") belongs to the synchronisers; this repository just
 * exposes read / upsert / delete.
 */
export class SyncRowMetaRepository extends Disposable implements ISyncRowMetaRepository {
  constructor(
    @IDBAdaptorService private readonly _dbService: IDBAdaptorService
  ) {
    super();
  }

  private get _db() {
    return this._dbService.db;
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
