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

import type { SQLiteDatabase } from 'expo-sqlite';
import type { DatabaseMobile } from './database-mobile-adaptor.service';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseAsync } from 'expo-sqlite';
import * as entities from '../entities';
import migrations from '../migrations/index.generated';
import { IDatabaseMobileAdaptorService } from './database-mobile-adaptor.service';

const DB_NAME = 'termlnk-mobile.db';

export { IDatabaseMobileAdaptorService };
export type { DatabaseMobile };

export class ExpoSqliteAdaptor extends Disposable implements IDatabaseMobileAdaptorService {
  private _sqlite: SQLiteDatabase | null = null;
  private _db: DatabaseMobile | null = null;
  private _readyPromise: Promise<DatabaseMobile> | null = null;

  // Plain identifier + explicit assignment: the mobile Babel pipeline cannot
  // combine a parameter decorator with a TS parameter property.
  private readonly _logService: ILogService;

  constructor(
    @Inject(ILogService) logService: ILogService
  ) {
    super();
    this._logService = logService;
  }

  override dispose(): void {
    super.dispose();
    // Best-effort close. closeAsync may not exist on all builds; the OS reclaims the
    // file descriptor on process exit anyway.
    const db = this._sqlite;
    this._sqlite = null;
    this._db = null;
    if (db) {
      void db.closeAsync?.().catch((err) => {
        this._logService.warn('[ExpoSqliteAdaptor] close failed:', err);
      });
    }
  }

  ready(): Promise<DatabaseMobile> {
    if (this._db) {
      return Promise.resolve(this._db);
    }
    if (!this._readyPromise) {
      this._readyPromise = this._init().finally(() => {
        this._readyPromise = null;
      });
    }
    return this._readyPromise;
  }

  async close(): Promise<void> {
    const db = this._sqlite;
    this._sqlite = null;
    this._db = null;
    if (db) {
      try {
        await db.closeAsync?.();
      } catch (err) {
        this._logService.warn('[ExpoSqliteAdaptor] close failed:', err);
      }
    }
  }

  private async _init(): Promise<DatabaseMobile> {
    const sqlite = await openDatabaseAsync(DB_NAME);
    // PRAGMA must run before any query so drizzle's first statement honors WAL.
    sqlite.execSync('PRAGMA journal_mode = WAL;');
    sqlite.execSync('PRAGMA foreign_keys = ON;');
    const db = drizzle(sqlite, { schema: entities });
    await migrate(db, migrations);
    this._sqlite = sqlite;
    this._db = db;
    this._logService.debug('[ExpoSqliteAdaptor] DB ready (drizzle + migrations applied).');
    return db;
  }
}
