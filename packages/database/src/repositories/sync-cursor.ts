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
import type { ISyncCursorEntity } from '../entities/sync-cursor';
import { Disposable } from '@termlnk/core';
import { eq } from 'drizzle-orm';
import { syncCursorEntity } from '../entities/sync-cursor';
import { IDBAdaptorService } from '../services/db-adaptor.service';

/** 服务端 opaque 拉取游标——每资源类型一行。 */
export class SyncCursorRepository extends Disposable {
  constructor(
    @IDBAdaptorService private readonly _dbService: IDBAdaptorService
  ) {
    super();
  }

  private get _db() {
    return this._dbService.db as BetterSQLite3Database<typeof schema>;
  }

  async get(resource: SyncResourceId): Promise<ISyncCursorEntity | null> {
    const rows = await this._db
      .select()
      .from(syncCursorEntity)
      .where(eq(syncCursorEntity.resource, resource))
      .limit(1);
    return rows[0] ?? null;
  }

  async upsert(cursor: ISyncCursorEntity): Promise<void> {
    await this._db
      .insert(syncCursorEntity)
      .values(cursor)
      .onConflictDoUpdate({
        target: syncCursorEntity.resource,
        set: { cursor: cursor.cursor, lastPulledAt: cursor.lastPulledAt },
      });
  }

  /** forceFullResync 用——删除游标后下次 pull 等价于"从头开始"。 */
  async delete(resource: SyncResourceId): Promise<void> {
    await this._db
      .delete(syncCursorEntity)
      .where(eq(syncCursorEntity.resource, resource));
  }
}
