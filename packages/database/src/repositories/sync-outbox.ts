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

import type { ISyncOutboxInsert, ISyncOutboxRepository, ISyncOutboxRow, SyncResourceId } from '@termlnk/sync';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../entities';
import type { ISyncOutboxEntity } from '../entities/sync-outbox';
import { Buffer } from 'node:buffer';
import { Disposable } from '@termlnk/core';
import { and, asc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { generateId } from '../entities/base';
import { syncOutboxEntity } from '../entities/sync-outbox';
import { IDBAdaptorService } from '../services/db-adaptor.service';

/**
 * Data access for the `sync_outbox` table.
 *
 * Pure CRUD — no business orchestration (no `clientMutId` allocation, no
 * `changed$` notifications, no retry scheduling). Those live in
 * `SyncOutboxService` (`@termlnk/sync-engine`).
 *
 * The contract (`ISyncOutboxRepository`) speaks `Uint8Array`; the Buffer
 * conversion that `better-sqlite3`'s blob binding needs is confined here so the
 * platform-agnostic engine never touches `node:buffer`.
 */
export class SyncOutboxRepository extends Disposable implements ISyncOutboxRepository {
  constructor(
    @IDBAdaptorService private readonly _dbService: IDBAdaptorService
  ) {
    super();
  }

  private get _db() {
    return this._dbService.db as BetterSQLite3Database<typeof schema>;
  }

  /**
   * Persist one mutation. The repository assigns `id` (a business-agnostic
   * PK) when the caller omits it. Returns the row as stored.
   */
  async insert(record: ISyncOutboxInsert): Promise<ISyncOutboxRow> {
    const id = record.id ?? generateId();
    const inserted = await this._db
      .insert(syncOutboxEntity)
      .values({
        ...record,
        id,
        payload: record.payload === null ? null : Buffer.from(record.payload),
      })
      .returning();
    return toRow(inserted[0]);
  }

  /**
   * Read pending mutations FIFO: `createdAt` asc, tie-break by `clientMutId`.
   * Does not delete — rows stay until the server acks them.
   */
  async selectFifo(limit?: number): Promise<ISyncOutboxRow[]> {
    const query = this._db
      .select()
      .from(syncOutboxEntity)
      .orderBy(asc(syncOutboxEntity.createdAt), asc(syncOutboxEntity.clientMutId));
    const rows = await (limit && limit > 0 ? query.limit(limit) : query);
    return rows.map(toRow);
  }

  /** Drop rows acknowledged by the server, by `clientMutId`. */
  async deleteByClientMutIds(clientMutIds: number[]): Promise<void> {
    if (clientMutIds.length === 0) {
      return;
    }
    await this._db
      .delete(syncOutboxEntity)
      .where(inArray(syncOutboxEntity.clientMutId, clientMutIds));
  }

  /** Bump `retry_count` when the server rejects rows; the rows stay. Returns the new counts. */
  async incrementRetry(clientMutIds: number[]): Promise<{ clientMutId: number; retryCount: number }[]> {
    if (clientMutIds.length === 0) {
      return [];
    }
    return this._db
      .update(syncOutboxEntity)
      .set({ retryCount: sql`${syncOutboxEntity.retryCount} + 1` })
      .where(inArray(syncOutboxEntity.clientMutId, clientMutIds))
      .returning({ clientMutId: syncOutboxEntity.clientMutId, retryCount: syncOutboxEntity.retryCount });
  }

  /**
   * Rebase a pending mutation onto a newer server version after a baseVersion conflict.
   * Leaves `created_at` untouched so the row keeps its FIFO position.
   */
  async updateBaseVersion(clientMutId: number, baseVersion: number): Promise<void> {
    await this._db
      .update(syncOutboxEntity)
      .set({ baseVersion })
      .where(eq(syncOutboxEntity.clientMutId, clientMutId));
  }

  async countAll(): Promise<number> {
    const rows = await this._db
      .select({ count: sql<number>`count(*)` })
      .from(syncOutboxEntity);
    return rows[0]?.count ?? 0;
  }

  async countByResource(resource: SyncResourceId): Promise<number> {
    const rows = await this._db
      .select({ count: sql<number>`count(*)` })
      .from(syncOutboxEntity)
      .where(eq(syncOutboxEntity.resource, resource));
    return rows[0]?.count ?? 0;
  }

  async deleteByResource(resource: SyncResourceId): Promise<void> {
    await this._db
      .delete(syncOutboxEntity)
      .where(eq(syncOutboxEntity.resource, resource));
  }

  /** Drop the pending row(s) for one (resource, entityId); returns the deleted count. */
  async deleteByResourceAndEntityId(resource: SyncResourceId, entityId: string): Promise<number> {
    const result = await this._db
      .delete(syncOutboxEntity)
      .where(and(eq(syncOutboxEntity.resource, resource), eq(syncOutboxEntity.entityId, entityId)))
      .returning({ clientMutId: syncOutboxEntity.clientMutId });
    return result.length;
  }

  /**
   * Delete outbox rows whose `resource` matches and `entityId` starts with any of the given
   * prefixes. Used to evict garbage written by historical bugs (e.g. self-referential
   * `config` enqueue loops) without touching legitimate user data. Returns the number of
   * deleted rows so callers can log the cleanup.
   */
  async deleteByResourceAndEntityIdPrefixes(
    resource: SyncResourceId,
    prefixes: readonly string[]
  ): Promise<number> {
    if (prefixes.length === 0) {
      return 0;
    }
    // LIKE-escape `%` and `_` so a prefix containing them stays literal. Drizzle interpolates
    // the bound value verbatim; the SQLite engine handles the escape character we declare.
    const escapeLike = (input: string): string => input.replace(/[\\%_]/g, '\\$&');
    const conditions = prefixes.map((prefix) =>
      like(syncOutboxEntity.entityId, `${escapeLike(prefix)}%`)
    );
    const predicate = conditions.length === 1 ? conditions[0] : or(...conditions);
    const result = await this._db
      .delete(syncOutboxEntity)
      .where(and(eq(syncOutboxEntity.resource, resource), predicate))
      .returning({ clientMutId: syncOutboxEntity.clientMutId });
    return result.length;
  }

  /**
   * Largest stored `client_mut_id`; used by `SyncOutboxService` on startup to
   * realign its in-memory counter. Returns 0 when the table is empty.
   */
  async maxClientMutId(): Promise<number> {
    const rows = await this._db
      .select({ max: sql<number | null>`max(${syncOutboxEntity.clientMutId})` })
      .from(syncOutboxEntity);
    return rows[0]?.max ?? 0;
  }
}

// Map a stored row to the platform-agnostic contract shape. better-sqlite3 returns the BLOB
// payload as a Node Buffer backed by a shared pool; copy it into a standalone Uint8Array so
// the engine (which the contract promises never sees Buffer) gets honest, isolated bytes.
function toRow(entity: ISyncOutboxEntity): ISyncOutboxRow {
  return {
    ...entity,
    payload: entity.payload === null ? null : new Uint8Array(entity.payload),
  };
}
