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
import { createIdentifier, Disposable, ILogService, Inject } from '@termlnk/core';
import { openDatabaseAsync } from 'expo-sqlite';

const DB_NAME = 'termlnk-mobile.db';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS hosts (
  id TEXT PRIMARY KEY,
  pid TEXT NOT NULL DEFAULT 'root',
  tree TEXT,
  label TEXT NOT NULL,
  type TEXT NOT NULL,
  addr TEXT,
  port INTEGER,
  sort INTEGER NOT NULL DEFAULT 0,
  credential_ct TEXT,
  proxy_ct TEXT,
  settings_json TEXT,
  host_chain_ids_json TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_hosts_pid ON hosts(pid);
CREATE INDEX IF NOT EXISTS idx_hosts_sort ON hosts(sort);

CREATE TABLE IF NOT EXISTS identities (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  username TEXT,
  password_ct TEXT,
  key_id TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ssh_keys (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  algorithm TEXT,
  bits INTEGER,
  private_key_ct TEXT,
  public_key TEXT,
  certificate TEXT,
  passphrase_ct TEXT,
  save_passphrase INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  public_key_fingerprint TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS known_hosts (
  id TEXT PRIMARY KEY,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 22,
  key_type TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  public_key TEXT,
  last_seen_at TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_known_hosts_lookup ON known_hosts(host, port);

-- Sync engine bookkeeping tables (mirror @termlnk/database's Drizzle schema). The engine
-- treats payloads opaquely; secrets in domain rows are encrypted at rest by the repository
-- layer (MobileSecretCipherService) and re-encrypted under the sync master key for transport.
CREATE TABLE IF NOT EXISTS sync_outbox (
  id TEXT PRIMARY KEY,
  client_mut_id INTEGER NOT NULL,
  resource TEXT NOT NULL,
  op TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload BLOB,
  base_version INTEGER,
  created_at INTEGER NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_resource ON sync_outbox(resource);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_client_mut_id ON sync_outbox(client_mut_id);

CREATE TABLE IF NOT EXISTS sync_row_meta (
  resource TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (resource, entity_id)
);

CREATE TABLE IF NOT EXISTS sync_field_meta (
  resource TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (resource, entity_id, field)
);

CREATE TABLE IF NOT EXISTS sync_cursor (
  resource TEXT PRIMARY KEY,
  cursor TEXT NOT NULL,
  last_pulled_at INTEGER NOT NULL
);

-- Key-value config store (key + subKey JSON) backing ISyncConfigRepository: the engine
-- persists clientId / lastClientMutId / userEnabled here.
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_meta (
  resource TEXT PRIMARY KEY,
  cursor TEXT
);

CREATE TABLE IF NOT EXISTS recent_sessions (
  host_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  last_used_at INTEGER NOT NULL,
  PRIMARY KEY (host_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_recent_sessions_last_used_at ON recent_sessions(last_used_at);
`;

export interface IMobileSqliteDatabaseService {
  ready(): Promise<SQLiteDatabase>;
}

export const IMobileSqliteDatabaseService = createIdentifier<IMobileSqliteDatabaseService>('mobile.sqlite-database.service');

export class MobileSqliteDatabaseService extends Disposable implements IMobileSqliteDatabaseService {
  private _db: SQLiteDatabase | null = null;
  private _readyPromise: Promise<SQLiteDatabase> | null = null;

  // Field declaration is separated from the constructor parameter because
  // babel-plugin-parameter-decorator cannot pair a parameter decorator with a TypeScript
  // parameter property — see apps/mobile/babel.config.js.
  private readonly _logService: ILogService;

  constructor(
    @Inject(ILogService) logService: ILogService
  ) {
    super();
    this._logService = logService;
  }

  override dispose(): void {
    super.dispose();
    // Best-effort close. closeAsync may not exist on all builds; ignore failures since
    // the OS reclaims fd on process exit anyway.
    const db = this._db;
    this._db = null;
    if (db) {
      void db.closeAsync?.().catch((err) => {
        this._logService.warn('[MobileSqliteDatabase] close failed', err);
      });
    }
  }

  ready(): Promise<SQLiteDatabase> {
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

  private async _init(): Promise<SQLiteDatabase> {
    const db = await openDatabaseAsync(DB_NAME);
    await db.execAsync(SCHEMA_SQL);
    this._db = db;
    this._logService.debug('[MobileSqliteDatabase] opened and migrated');
    return db;
  }
}
