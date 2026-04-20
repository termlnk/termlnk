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

import type { Nullable } from '@termlnk/core';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { Database, IDBAdaptorService } from '../db-adaptor.service';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Disposable } from '@termlnk/core';
import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { DEFAULT_DRIZZLE_MIGRATIONS_TABLE } from '../../config/migrations';
import * as entities from '../../entities';

export interface ISQLiteDatabaseOptions {
  filename?: string;
  migrationsFolder?: string;
  migrationsTable?: string;
}

export class SQLiteAdaptor extends Disposable implements IDBAdaptorService {
  private _sqlite: Nullable<BetterSqlite3.Database>;
  private _db: Nullable<Database>;
  private readonly _migrationsFolder: Nullable<string>;
  private readonly _migrationsTable: string;

  constructor(
    private readonly _options: ISQLiteDatabaseOptions
  ) {
    super();

    this._migrationsFolder = _options.migrationsFolder;
    this._migrationsTable = _options.migrationsTable || DEFAULT_DRIZZLE_MIGRATIONS_TABLE;
  }

  get db(): Database {
    if (!this._db) {
      throw new Error('[SQLiteAdaptor] Database not initialized. Call initialize() first.');
    }
    return this._db;
  }

  async initialize(): Promise<void> {
    if (this._db) {
      return;
    }

    if (this._options.filename) {
      mkdirSync(dirname(this._options.filename), { recursive: true });
    }

    this._sqlite = new BetterSqlite3(this._options.filename);
    this._sqlite.pragma('journal_mode = WAL');
    this._sqlite.pragma('foreign_keys = ON');

    this._db = drizzle({
      client: this._sqlite,
      schema: entities,
    });

    this._migration();
  }

  async close(): Promise<void> {
    if (this._sqlite) {
      this._sqlite.close();
      this._sqlite = null;
      this._db = null;
    }
  }

  override dispose(): void {
    this.close();
  }

  private _migration(): void {
    if (!this._migrationsFolder) {
      console.warn('[SQLiteAdaptor] No migrations folder specified. Skipping migration.');
      return;
    }

    try {
      migrate(this._db! as BetterSQLite3Database<typeof entities>, {
        migrationsFolder: this._migrationsFolder,
        migrationsTable: this._migrationsTable,
      });
    } catch (error) {
      console.error('[SQLiteAdaptor] Migration failed:', error);
      throw new Error(`Database migration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
