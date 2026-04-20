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

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../entities';
import { Disposable } from '@termlnk/core';
import { eq } from 'drizzle-orm';
import { terminalSessionBackupEntity } from '../entities/terminal-session-backup';
import { IDBAdaptorService } from '../services/db-adaptor.service';

/**
 * Stores a single row (id = SINGLETON_ID) holding the entire terminal
 * persistence state as a JSON blob. A dedicated table keeps multi-MB
 * serialized buffers off the shared `config` table, so small settings
 * reads don't fan out over a big payload.
 */
const SINGLETON_ID = 'default';

export class TerminalSessionBackupRepository extends Disposable {
  constructor(
    @IDBAdaptorService private readonly _dbService: IDBAdaptorService
  ) {
    super();
  }

  private get _db() {
    return this._dbService.db as BetterSQLite3Database<typeof schema>;
  }

  async load<T = unknown>(): Promise<T | null> {
    const rows = await this._db
      .select()
      .from(terminalSessionBackupEntity)
      .where(eq(terminalSessionBackupEntity.id, SINGLETON_ID))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }
    return rows[0].data as T;
  }

  async save<T = unknown>(data: T): Promise<void> {
    const now = new Date().toISOString();
    await this._db
      .insert(terminalSessionBackupEntity)
      .values({ id: SINGLETON_ID, data, updatedAt: now })
      .onConflictDoUpdate({
        target: terminalSessionBackupEntity.id,
        set: { data, updatedAt: now },
      });
  }

  async clear(): Promise<void> {
    await this._db
      .delete(terminalSessionBackupEntity)
      .where(eq(terminalSessionBackupEntity.id, SINGLETON_ID));
  }
}
