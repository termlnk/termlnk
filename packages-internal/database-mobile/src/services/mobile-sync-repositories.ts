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
import { and, asc, count, eq, inArray, like, max, or, sql } from 'drizzle-orm';
import { Subject } from 'rxjs';
import { configEntity } from '../entities/config-kv';
import { syncCursorEntity } from '../entities/sync-cursor';
import { syncFieldMetaEntity } from '../entities/sync-field-meta';
import { syncOutboxEntity } from '../entities/sync-outbox';
import { syncRowMetaEntity } from '../entities/sync-row-meta';
import { IDatabaseMobileAdaptorService } from './expo-sqlite-adaptor.service';

// Drizzle-backed implementations of the sync engine's bookkeeping repositories. They
// mirror @termlnk/database's desktop entities row-for-row so the platform-agnostic
// engine (@termlnk/sync-engine) behaves identically on both ends. The `payload` BLOB
// column is declared with a Uint8Array-native customType (see ../entities/base.ts);
// avoid `mode: 'buffer'` here because Hermes lacks the Node `Buffer` global.

// --- Outbox ------------------------------------------------------------------------------

export class MobileSyncOutboxRepository extends Disposable implements ISyncOutboxRepository {
  private readonly _adaptor: IDatabaseMobileAdaptorService;

  constructor(
    @Inject(IDatabaseMobileAdaptorService) adaptor: IDatabaseMobileAdaptorService
  ) {
    super();
    this._adaptor = adaptor;
  }

  async insert(record: ISyncOutboxInsert): Promise<ISyncOutboxRow> {
    const db = await this._adaptor.ready();
    const id = record.id ?? generateRandomId(24);
    const payload = record.payload ?? null;
    const retryCount = record.retryCount ?? 0;
    db.insert(syncOutboxEntity)
      .values({
        id,
        clientMutId: record.clientMutId,
        resource: record.resource,
        op: record.op,
        entityId: record.entityId,
        payload,
        baseVersion: record.baseVersion,
        createdAt: record.createdAt,
        retryCount,
      })
      .run();
    return {
      id,
      clientMutId: record.clientMutId,
      resource: record.resource,
      op: record.op,
      entityId: record.entityId,
      payload,
      baseVersion: record.baseVersion,
      createdAt: record.createdAt,
      retryCount,
    };
  }

  async selectFifo(limit?: number): Promise<ISyncOutboxRow[]> {
    const db = await this._adaptor.ready();
    const base = db.select()
      .from(syncOutboxEntity)
      .orderBy(asc(syncOutboxEntity.createdAt), asc(syncOutboxEntity.clientMutId));
    const rows = (limit && limit > 0) ? base.limit(limit).all() : base.all();
    return rows.map((r) => ({
      id: r.id,
      clientMutId: r.clientMutId,
      resource: r.resource,
      op: r.op,
      entityId: r.entityId,
      payload: r.payload ?? null,
      baseVersion: r.baseVersion,
      createdAt: r.createdAt,
      retryCount: r.retryCount,
    }));
  }

  async deleteByClientMutIds(clientMutIds: number[]): Promise<void> {
    if (clientMutIds.length === 0) {
      return;
    }
    const db = await this._adaptor.ready();
    db.delete(syncOutboxEntity)
      .where(inArray(syncOutboxEntity.clientMutId, clientMutIds))
      .run();
  }

  async incrementRetry(clientMutIds: number[]): Promise<{ clientMutId: number; retryCount: number }[]> {
    if (clientMutIds.length === 0) {
      return [];
    }
    const db = await this._adaptor.ready();
    db.update(syncOutboxEntity)
      .set({ retryCount: sql`${syncOutboxEntity.retryCount} + 1` })
      .where(inArray(syncOutboxEntity.clientMutId, clientMutIds))
      .run();
    const rows = db.select({ clientMutId: syncOutboxEntity.clientMutId, retryCount: syncOutboxEntity.retryCount })
      .from(syncOutboxEntity)
      .where(inArray(syncOutboxEntity.clientMutId, clientMutIds))
      .all();
    return rows.map((r) => ({ clientMutId: r.clientMutId, retryCount: r.retryCount }));
  }

  async updateBaseVersion(clientMutId: number, baseVersion: number): Promise<void> {
    const db = await this._adaptor.ready();
    db.update(syncOutboxEntity)
      .set({ baseVersion })
      .where(eq(syncOutboxEntity.clientMutId, clientMutId))
      .run();
  }

  async countAll(): Promise<number> {
    const db = await this._adaptor.ready();
    const row = db.select({ c: count() }).from(syncOutboxEntity).get();
    return row?.c ?? 0;
  }

  async countByResource(resource: SyncResourceId): Promise<number> {
    const db = await this._adaptor.ready();
    const row = db.select({ c: count() })
      .from(syncOutboxEntity)
      .where(eq(syncOutboxEntity.resource, resource))
      .get();
    return row?.c ?? 0;
  }

  async deleteByResource(resource: SyncResourceId): Promise<void> {
    const db = await this._adaptor.ready();
    db.delete(syncOutboxEntity).where(eq(syncOutboxEntity.resource, resource)).run();
  }

  async deleteByResourceAndEntityId(resource: SyncResourceId, entityId: string): Promise<number> {
    const db = await this._adaptor.ready();
    const result = db.delete(syncOutboxEntity)
      .where(and(eq(syncOutboxEntity.resource, resource), eq(syncOutboxEntity.entityId, entityId)))
      .run();
    return result.changes ?? 0;
  }

  async deleteByResourceAndEntityIdPrefixes(resource: SyncResourceId, prefixes: readonly string[]): Promise<number> {
    if (prefixes.length === 0) {
      return 0;
    }
    const db = await this._adaptor.ready();
    const escapeLike = (input: string): string => input.replace(/[\\%_]/g, '\\$&');
    const clauses = prefixes.map((p) => like(syncOutboxEntity.entityId, `${escapeLike(p)}%`));
    const result = db.delete(syncOutboxEntity)
      .where(and(eq(syncOutboxEntity.resource, resource), or(...clauses)))
      .run();
    return result.changes ?? 0;
  }

  async maxClientMutId(): Promise<number> {
    const db = await this._adaptor.ready();
    const row = db.select({ m: max(syncOutboxEntity.clientMutId) }).from(syncOutboxEntity).get();
    return row?.m ?? 0;
  }
}

// --- Row meta ----------------------------------------------------------------------------

export class MobileSyncRowMetaRepository extends Disposable implements ISyncRowMetaRepository {
  private readonly _adaptor: IDatabaseMobileAdaptorService;

  constructor(
    @Inject(IDatabaseMobileAdaptorService) adaptor: IDatabaseMobileAdaptorService
  ) {
    super();
    this._adaptor = adaptor;
  }

  async get(resource: SyncResourceId, entityId: string): Promise<ISyncRowMeta | null> {
    const db = await this._adaptor.ready();
    const r = db.select().from(syncRowMetaEntity).where(and(eq(syncRowMetaEntity.resource, resource), eq(syncRowMetaEntity.entityId, entityId))).get();
    return r
      ? { resource: r.resource, entityId: r.entityId, version: r.version, updatedAt: r.updatedAt }
      : null;
  }

  async getAll(resource: SyncResourceId): Promise<ISyncRowMeta[]> {
    const db = await this._adaptor.ready();
    const rows = db.select().from(syncRowMetaEntity).where(eq(syncRowMetaEntity.resource, resource)).all();
    return rows.map((r) => ({ resource: r.resource, entityId: r.entityId, version: r.version, updatedAt: r.updatedAt }));
  }

  async upsert(meta: ISyncRowMeta): Promise<void> {
    const db = await this._adaptor.ready();
    db.insert(syncRowMetaEntity)
      .values({ resource: meta.resource, entityId: meta.entityId, version: meta.version, updatedAt: meta.updatedAt })
      .onConflictDoUpdate({
        target: [syncRowMetaEntity.resource, syncRowMetaEntity.entityId],
        set: { version: meta.version, updatedAt: meta.updatedAt },
      })
      .run();
  }

  async delete(resource: SyncResourceId, entityId: string): Promise<void> {
    const db = await this._adaptor.ready();
    db.delete(syncRowMetaEntity)
      .where(and(eq(syncRowMetaEntity.resource, resource), eq(syncRowMetaEntity.entityId, entityId)))
      .run();
  }

  async deleteResource(resource: SyncResourceId): Promise<void> {
    const db = await this._adaptor.ready();
    db.delete(syncRowMetaEntity).where(eq(syncRowMetaEntity.resource, resource)).run();
  }
}

// --- Field meta --------------------------------------------------------------------------

export class MobileSyncFieldMetaRepository extends Disposable implements ISyncFieldMetaRepository {
  private readonly _adaptor: IDatabaseMobileAdaptorService;

  constructor(
    @Inject(IDatabaseMobileAdaptorService) adaptor: IDatabaseMobileAdaptorService
  ) {
    super();
    this._adaptor = adaptor;
  }

  async get(resource: SyncResourceId, entityId: string, field: string): Promise<ISyncFieldMeta | null> {
    const db = await this._adaptor.ready();
    const r = db.select().from(syncFieldMetaEntity).where(and(
      eq(syncFieldMetaEntity.resource, resource),
      eq(syncFieldMetaEntity.entityId, entityId),
      eq(syncFieldMetaEntity.field, field)
    )).get();
    return r
      ? { resource: r.resource, entityId: r.entityId, field: r.field, updatedAt: r.updatedAt }
      : null;
  }

  async getByEntity(resource: SyncResourceId, entityId: string): Promise<ISyncFieldMeta[]> {
    const db = await this._adaptor.ready();
    const rows = db.select().from(syncFieldMetaEntity).where(and(eq(syncFieldMetaEntity.resource, resource), eq(syncFieldMetaEntity.entityId, entityId))).all();
    return rows.map((r) => ({ resource: r.resource, entityId: r.entityId, field: r.field, updatedAt: r.updatedAt }));
  }

  async getAllByResource(resource: SyncResourceId): Promise<ISyncFieldMeta[]> {
    const db = await this._adaptor.ready();
    const rows = db.select().from(syncFieldMetaEntity).where(eq(syncFieldMetaEntity.resource, resource)).all();
    return rows.map((r) => ({ resource: r.resource, entityId: r.entityId, field: r.field, updatedAt: r.updatedAt }));
  }

  async upsert(meta: ISyncFieldMeta): Promise<void> {
    const db = await this._adaptor.ready();
    db.insert(syncFieldMetaEntity)
      .values({ resource: meta.resource, entityId: meta.entityId, field: meta.field, updatedAt: meta.updatedAt })
      .onConflictDoUpdate({
        target: [syncFieldMetaEntity.resource, syncFieldMetaEntity.entityId, syncFieldMetaEntity.field],
        set: { updatedAt: meta.updatedAt },
      })
      .run();
  }

  async delete(resource: SyncResourceId, entityId: string, field: string): Promise<void> {
    const db = await this._adaptor.ready();
    db.delete(syncFieldMetaEntity)
      .where(and(
        eq(syncFieldMetaEntity.resource, resource),
        eq(syncFieldMetaEntity.entityId, entityId),
        eq(syncFieldMetaEntity.field, field)
      ))
      .run();
  }

  async deleteResource(resource: SyncResourceId): Promise<void> {
    const db = await this._adaptor.ready();
    db.delete(syncFieldMetaEntity).where(eq(syncFieldMetaEntity.resource, resource)).run();
  }
}

// --- Cursor ------------------------------------------------------------------------------

export class MobileSyncCursorRepository extends Disposable implements ISyncCursorRepository {
  private readonly _adaptor: IDatabaseMobileAdaptorService;

  constructor(
    @Inject(IDatabaseMobileAdaptorService) adaptor: IDatabaseMobileAdaptorService
  ) {
    super();
    this._adaptor = adaptor;
  }

  async get(resource: SyncResourceId): Promise<ISyncCursorRow | null> {
    const db = await this._adaptor.ready();
    const r = db.select().from(syncCursorEntity).where(eq(syncCursorEntity.resource, resource)).get();
    return r
      ? { resource: r.resource, cursor: r.cursor, lastPulledAt: r.lastPulledAt }
      : null;
  }

  async upsert(cursor: ISyncCursorRow): Promise<void> {
    const db = await this._adaptor.ready();
    db.insert(syncCursorEntity)
      .values({ resource: cursor.resource, cursor: cursor.cursor, lastPulledAt: cursor.lastPulledAt })
      .onConflictDoUpdate({
        target: syncCursorEntity.resource,
        set: { cursor: cursor.cursor, lastPulledAt: cursor.lastPulledAt },
      })
      .run();
  }

  async delete(resource: SyncResourceId): Promise<void> {
    const db = await this._adaptor.ready();
    db.delete(syncCursorEntity).where(eq(syncCursorEntity.resource, resource)).run();
  }
}

// --- Config (key/subKey JSON) ------------------------------------------------------------

// Minimal key/subKey config store backing the field-level LWW `config` resource. The sync
// engine also persists its own state here (clientId / lastClientMutId / userEnabled) under
// 'sync.config' — that key is in NON_SYNCABLE_CONFIG_KEYS, so ConfigSynchroniser filters it
// (and the other device-bound keys) out of both the outbox and inbound patches.
export class MobileSyncConfigRepository extends Disposable implements ISyncConfigRepository {
  private readonly _changed$ = new Subject<IConfigChangeEvent>();
  readonly changed$: Observable<IConfigChangeEvent> = this._changed$.asObservable();

  private readonly _adaptor: IDatabaseMobileAdaptorService;

  constructor(
    @Inject(IDatabaseMobileAdaptorService) adaptor: IDatabaseMobileAdaptorService
  ) {
    super();
    this._adaptor = adaptor;
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
    const db = await this._adaptor.ready();
    const rows = db.select({ key: configEntity.key, valueJson: configEntity.valueJson }).from(configEntity).all();
    return rows.map((r) => ({ key: r.key, value: safeParse(r.valueJson) }));
  }

  async set(key: string, value: unknown): Promise<void> {
    await this._writeObject(key, value);
    this._changed$.next({ type: 'set', key });
  }

  async delete(key: string): Promise<void> {
    const db = await this._adaptor.ready();
    db.delete(configEntity).where(eq(configEntity.key, key)).run();
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
    const db = await this._adaptor.ready();
    const row = db.select({ valueJson: configEntity.valueJson })
      .from(configEntity)
      .where(eq(configEntity.key, key))
      .get();
    return row ? safeParse(row.valueJson) : null;
  }

  private async _writeObject(key: string, value: unknown): Promise<void> {
    const db = await this._adaptor.ready();
    const now = new Date().toISOString();
    const serialized = JSON.stringify(value ?? null);
    db.insert(configEntity)
      .values({ key, valueJson: serialized, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: configEntity.key,
        set: { valueJson: serialized, updatedAt: now },
      })
      .run();
  }
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
