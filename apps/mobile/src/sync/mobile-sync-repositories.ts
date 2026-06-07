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

import type {
  IConfigChangeEvent,
  IConfigEntry,
  ISyncConfigRepository,
  ISyncCursorRepository,
  ISyncCursorRow,
  ISyncFieldMeta,
  ISyncFieldMetaRepository,
  ISyncOutboxInsert,
  ISyncOutboxRepository,
  ISyncOutboxRow,
  ISyncRowMeta,
  ISyncRowMetaRepository,
  SyncResourceId,
} from '@termlnk/sync';
import type { Observable } from 'rxjs';
import { Disposable, generateRandomId, Inject } from '@termlnk/core';
import { Subject } from 'rxjs';
import { IMobileSqliteDatabaseService } from '../storage/mobile-sqlite-database.service';

// expo-sqlite implementations of the sync engine's bookkeeping repositories. They mirror
// the Drizzle versions in @termlnk/database row-for-row so the platform-agnostic engine
// (@termlnk/sync-engine) behaves identically on both ends. expo-sqlite binds/returns BLOB
// columns as Uint8Array, so the outbox payload never needs the Buffer dance the desktop
// side does.

interface IOutboxRowSql {
  id: string;
  client_mut_id: number;
  resource: string;
  op: string;
  entity_id: string;
  payload: Uint8Array | null;
  base_version: number | null;
  created_at: number;
  retry_count: number;
}

function sqlToOutboxRow(r: IOutboxRowSql): ISyncOutboxRow {
  return {
    id: r.id,
    clientMutId: r.client_mut_id,
    resource: r.resource as SyncResourceId,
    op: r.op as 'upsert' | 'delete',
    entityId: r.entity_id,
    payload: r.payload ?? null,
    baseVersion: r.base_version,
    createdAt: r.created_at,
    retryCount: r.retry_count,
  };
}

export class MobileSyncOutboxRepository extends Disposable implements ISyncOutboxRepository {
  private readonly _sqlite: IMobileSqliteDatabaseService;

  constructor(
    @Inject(IMobileSqliteDatabaseService) sqlite: IMobileSqliteDatabaseService
  ) {
    super();
    this._sqlite = sqlite;
  }

  async insert(record: ISyncOutboxInsert): Promise<ISyncOutboxRow> {
    const db = await this._sqlite.ready();
    const id = record.id ?? generateRandomId(24);
    await db.runAsync(
      `INSERT INTO sync_outbox (id, client_mut_id, resource, op, entity_id, payload, base_version, created_at, retry_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, record.clientMutId, record.resource, record.op, record.entityId, record.payload ?? null, record.baseVersion, record.createdAt, record.retryCount ?? 0]
    );
    return {
      id,
      clientMutId: record.clientMutId,
      resource: record.resource,
      op: record.op,
      entityId: record.entityId,
      payload: record.payload ?? null,
      baseVersion: record.baseVersion,
      createdAt: record.createdAt,
      retryCount: record.retryCount ?? 0,
    };
  }

  async selectFifo(limit?: number): Promise<ISyncOutboxRow[]> {
    const db = await this._sqlite.ready();
    const sql = `SELECT * FROM sync_outbox ORDER BY created_at ASC, client_mut_id ASC${limit && limit > 0 ? ' LIMIT ?' : ''}`;
    const rows = await db.getAllAsync<IOutboxRowSql>(sql, limit && limit > 0 ? [limit] : []);
    return rows.map(sqlToOutboxRow);
  }

  async deleteByClientMutIds(clientMutIds: number[]): Promise<void> {
    if (clientMutIds.length === 0) {
      return;
    }
    const db = await this._sqlite.ready();
    const placeholders = clientMutIds.map(() => '?').join(', ');
    await db.runAsync(`DELETE FROM sync_outbox WHERE client_mut_id IN (${placeholders})`, clientMutIds);
  }

  async incrementRetry(clientMutIds: number[]): Promise<{ clientMutId: number; retryCount: number }[]> {
    if (clientMutIds.length === 0) {
      return [];
    }
    const db = await this._sqlite.ready();
    const placeholders = clientMutIds.map(() => '?').join(', ');
    await db.runAsync(
      `UPDATE sync_outbox SET retry_count = retry_count + 1 WHERE client_mut_id IN (${placeholders})`,
      clientMutIds
    );
    const rows = await db.getAllAsync<{ client_mut_id: number; retry_count: number }>(
      `SELECT client_mut_id, retry_count FROM sync_outbox WHERE client_mut_id IN (${placeholders})`,
      clientMutIds
    );
    return rows.map((r) => ({ clientMutId: r.client_mut_id, retryCount: r.retry_count }));
  }

  async updateBaseVersion(clientMutId: number, baseVersion: number): Promise<void> {
    const db = await this._sqlite.ready();
    await db.runAsync('UPDATE sync_outbox SET base_version = ? WHERE client_mut_id = ?', [baseVersion, clientMutId]);
  }

  async countAll(): Promise<number> {
    const db = await this._sqlite.ready();
    const row = await db.getFirstAsync<{ c: number }>('SELECT count(*) AS c FROM sync_outbox');
    return row?.c ?? 0;
  }

  async countByResource(resource: SyncResourceId): Promise<number> {
    const db = await this._sqlite.ready();
    const row = await db.getFirstAsync<{ c: number }>('SELECT count(*) AS c FROM sync_outbox WHERE resource = ?', [resource]);
    return row?.c ?? 0;
  }

  async deleteByResource(resource: SyncResourceId): Promise<void> {
    const db = await this._sqlite.ready();
    await db.runAsync('DELETE FROM sync_outbox WHERE resource = ?', [resource]);
  }

  async deleteByResourceAndEntityId(resource: SyncResourceId, entityId: string): Promise<number> {
    const db = await this._sqlite.ready();
    const result = await db.runAsync('DELETE FROM sync_outbox WHERE resource = ? AND entity_id = ?', [resource, entityId]);
    return result.changes ?? 0;
  }

  async deleteByResourceAndEntityIdPrefixes(resource: SyncResourceId, prefixes: readonly string[]): Promise<number> {
    if (prefixes.length === 0) {
      return 0;
    }
    const db = await this._sqlite.ready();
    const escapeLike = (input: string): string => input.replace(/[\\%_]/g, '\\$&');
    const clause = prefixes.map(() => 'entity_id LIKE ? ESCAPE \'\\\'').join(' OR ');
    const params: (string)[] = [resource, ...prefixes.map((p) => `${escapeLike(p)}%`)];
    const result = await db.runAsync(`DELETE FROM sync_outbox WHERE resource = ? AND (${clause})`, params);
    return result.changes ?? 0;
  }

  async maxClientMutId(): Promise<number> {
    const db = await this._sqlite.ready();
    const row = await db.getFirstAsync<{ m: number | null }>('SELECT max(client_mut_id) AS m FROM sync_outbox');
    return row?.m ?? 0;
  }
}

interface IRowMetaSql {
  resource: string;
  entity_id: string;
  version: number;
  updated_at: number;
}

export class MobileSyncRowMetaRepository extends Disposable implements ISyncRowMetaRepository {
  private readonly _sqlite: IMobileSqliteDatabaseService;

  constructor(
    @Inject(IMobileSqliteDatabaseService) sqlite: IMobileSqliteDatabaseService
  ) {
    super();
    this._sqlite = sqlite;
  }

  async get(resource: SyncResourceId, entityId: string): Promise<ISyncRowMeta | null> {
    const db = await this._sqlite.ready();
    const r = await db.getFirstAsync<IRowMetaSql>('SELECT * FROM sync_row_meta WHERE resource = ? AND entity_id = ?', [resource, entityId]);
    return r ? { resource: r.resource as SyncResourceId, entityId: r.entity_id, version: r.version, updatedAt: r.updated_at } : null;
  }

  async getAll(resource: SyncResourceId): Promise<ISyncRowMeta[]> {
    const db = await this._sqlite.ready();
    const rows = await db.getAllAsync<IRowMetaSql>('SELECT * FROM sync_row_meta WHERE resource = ?', [resource]);
    return rows.map((r) => ({ resource: r.resource as SyncResourceId, entityId: r.entity_id, version: r.version, updatedAt: r.updated_at }));
  }

  async upsert(meta: ISyncRowMeta): Promise<void> {
    const db = await this._sqlite.ready();
    await db.runAsync(
      `INSERT INTO sync_row_meta (resource, entity_id, version, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(resource, entity_id) DO UPDATE SET version = excluded.version, updated_at = excluded.updated_at`,
      [meta.resource, meta.entityId, meta.version, meta.updatedAt]
    );
  }

  async delete(resource: SyncResourceId, entityId: string): Promise<void> {
    const db = await this._sqlite.ready();
    await db.runAsync('DELETE FROM sync_row_meta WHERE resource = ? AND entity_id = ?', [resource, entityId]);
  }

  async deleteResource(resource: SyncResourceId): Promise<void> {
    const db = await this._sqlite.ready();
    await db.runAsync('DELETE FROM sync_row_meta WHERE resource = ?', [resource]);
  }
}

interface IFieldMetaSql {
  resource: string;
  entity_id: string;
  field: string;
  updated_at: number;
}

export class MobileSyncFieldMetaRepository extends Disposable implements ISyncFieldMetaRepository {
  private readonly _sqlite: IMobileSqliteDatabaseService;

  constructor(
    @Inject(IMobileSqliteDatabaseService) sqlite: IMobileSqliteDatabaseService
  ) {
    super();
    this._sqlite = sqlite;
  }

  async get(resource: SyncResourceId, entityId: string, field: string): Promise<ISyncFieldMeta | null> {
    const db = await this._sqlite.ready();
    const r = await db.getFirstAsync<IFieldMetaSql>('SELECT * FROM sync_field_meta WHERE resource = ? AND entity_id = ? AND field = ?', [resource, entityId, field]);
    return r ? { resource: r.resource as SyncResourceId, entityId: r.entity_id, field: r.field, updatedAt: r.updated_at } : null;
  }

  async getByEntity(resource: SyncResourceId, entityId: string): Promise<ISyncFieldMeta[]> {
    const db = await this._sqlite.ready();
    const rows = await db.getAllAsync<IFieldMetaSql>('SELECT * FROM sync_field_meta WHERE resource = ? AND entity_id = ?', [resource, entityId]);
    return rows.map((r) => ({ resource: r.resource as SyncResourceId, entityId: r.entity_id, field: r.field, updatedAt: r.updated_at }));
  }

  async getAllByResource(resource: SyncResourceId): Promise<ISyncFieldMeta[]> {
    const db = await this._sqlite.ready();
    const rows = await db.getAllAsync<IFieldMetaSql>('SELECT * FROM sync_field_meta WHERE resource = ?', [resource]);
    return rows.map((r) => ({ resource: r.resource as SyncResourceId, entityId: r.entity_id, field: r.field, updatedAt: r.updated_at }));
  }

  async upsert(meta: ISyncFieldMeta): Promise<void> {
    const db = await this._sqlite.ready();
    await db.runAsync(
      `INSERT INTO sync_field_meta (resource, entity_id, field, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(resource, entity_id, field) DO UPDATE SET updated_at = excluded.updated_at`,
      [meta.resource, meta.entityId, meta.field, meta.updatedAt]
    );
  }

  async delete(resource: SyncResourceId, entityId: string, field: string): Promise<void> {
    const db = await this._sqlite.ready();
    await db.runAsync('DELETE FROM sync_field_meta WHERE resource = ? AND entity_id = ? AND field = ?', [resource, entityId, field]);
  }

  async deleteResource(resource: SyncResourceId): Promise<void> {
    const db = await this._sqlite.ready();
    await db.runAsync('DELETE FROM sync_field_meta WHERE resource = ?', [resource]);
  }
}

interface ICursorSql {
  resource: string;
  cursor: string;
  last_pulled_at: number;
}

export class MobileSyncCursorRepository extends Disposable implements ISyncCursorRepository {
  private readonly _sqlite: IMobileSqliteDatabaseService;

  constructor(
    @Inject(IMobileSqliteDatabaseService) sqlite: IMobileSqliteDatabaseService
  ) {
    super();
    this._sqlite = sqlite;
  }

  async get(resource: SyncResourceId): Promise<ISyncCursorRow | null> {
    const db = await this._sqlite.ready();
    const r = await db.getFirstAsync<ICursorSql>('SELECT * FROM sync_cursor WHERE resource = ?', [resource]);
    return r ? { resource: r.resource as SyncResourceId, cursor: r.cursor, lastPulledAt: r.last_pulled_at } : null;
  }

  async upsert(cursor: ISyncCursorRow): Promise<void> {
    const db = await this._sqlite.ready();
    await db.runAsync(
      `INSERT INTO sync_cursor (resource, cursor, last_pulled_at) VALUES (?, ?, ?)
       ON CONFLICT(resource) DO UPDATE SET cursor = excluded.cursor, last_pulled_at = excluded.last_pulled_at`,
      [cursor.resource, cursor.cursor, cursor.lastPulledAt]
    );
  }

  async delete(resource: SyncResourceId): Promise<void> {
    const db = await this._sqlite.ready();
    await db.runAsync('DELETE FROM sync_cursor WHERE resource = ?', [resource]);
  }
}

interface IConfigSql {
  key: string;
  value_json: string;
}

// Minimal key/subKey config store. The sync engine persists clientId / lastClientMutId /
// userEnabled here; the per-field LWW `config` resource itself is excluded from mobile sync
// (v1), so `changed$` never drives the outbox — it exists only to satisfy the contract.
export class MobileSyncConfigRepository extends Disposable implements ISyncConfigRepository {
  private readonly _changed$ = new Subject<IConfigChangeEvent>();
  readonly changed$: Observable<IConfigChangeEvent> = this._changed$.asObservable();

  private readonly _sqlite: IMobileSqliteDatabaseService;

  constructor(
    @Inject(IMobileSqliteDatabaseService) sqlite: IMobileSqliteDatabaseService
  ) {
    super();
    this._sqlite = sqlite;
  }

  override dispose(): void {
    super.dispose();
    this._changed$.complete();
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const obj = await this._readObject(key);
    return (obj as T) ?? null;
  }

  async getAll(): Promise<IConfigEntry[]> {
    const db = await this._sqlite.ready();
    const rows = await db.getAllAsync<IConfigSql>('SELECT key, value_json FROM config');
    return rows.map((r) => ({ key: r.key, value: safeParse(r.value_json) }));
  }

  async set(key: string, value: unknown): Promise<void> {
    await this._writeObject(key, value);
    this._changed$.next({ type: 'set', key });
  }

  async delete(key: string): Promise<void> {
    const db = await this._sqlite.ready();
    await db.runAsync('DELETE FROM config WHERE key = ?', [key]);
    this._changed$.next({ type: 'delete', key });
  }

  async getField<T = unknown>(key: string, field: string): Promise<T | null> {
    const obj = await this._readObject(key);
    if (!obj || typeof obj !== 'object') {
      return null;
    }
    return ((obj as Record<string, unknown>)[field] as T) ?? null;
  }

  async setField(key: string, field: string, value: unknown): Promise<void> {
    const obj = (await this._readObject(key)) as Record<string, unknown> | null;
    const next = { ...(obj ?? {}), [field]: value };
    await this._writeObject(key, next);
    this._changed$.next({ type: 'set', key, subKey: field });
  }

  async deleteField(key: string, field: string): Promise<void> {
    const obj = (await this._readObject(key)) as Record<string, unknown> | null;
    if (!obj) {
      return;
    }
    delete obj[field];
    await this._writeObject(key, obj);
    this._changed$.next({ type: 'delete', key, subKey: field });
  }

  private async _readObject(key: string): Promise<unknown> {
    const db = await this._sqlite.ready();
    const row = await db.getFirstAsync<IConfigSql>('SELECT value_json FROM config WHERE key = ?', [key]);
    return row ? safeParse(row.value_json) : null;
  }

  private async _writeObject(key: string, value: unknown): Promise<void> {
    const db = await this._sqlite.ready();
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO config (key, value_json, created_at, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      [key, JSON.stringify(value ?? null), now, now]
    );
  }
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
