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

import type { IKnownHostChangeEvent, KnownHostVerdict } from '@termlnk/terminal';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../entities';
import type { IKnownHostEntity, IKnownHostEntityInsert } from '../entities';
import { Disposable } from '@termlnk/core';
import { and, eq, inArray } from 'drizzle-orm';
import { Subject } from 'rxjs';
import { generateId } from '../entities/base';
import { knownHostEntity } from '../entities/known-host';
import { IDBAdaptorService } from '../services/db-adaptor.service';

export interface IKnownHostMatchResult {
  verdict: KnownHostVerdict;
  /** Present when verdict is 'changed': the conflicting stored record. */
  existing?: IKnownHostEntity;
}

export interface IKnownHostUpsert {
  host: string;
  port: number;
  keyType: string;
  fingerprint: string;
  publicKey?: string | null;
}

// Pure TOFU decision, separated from data access so it can be unit-tested without a
// native sqlite binding:
//   no record for host:port            -> unknown (first contact)
//   a record with the same fingerprint -> trusted
//   a record with same keyType but a different fingerprint -> changed (MITM alert)
//   otherwise (only other algorithms)  -> unknown (new algorithm, treat as first contact)
export function classifyKnownHost(
  candidates: IKnownHostEntity[],
  keyType: string,
  fingerprint: string
): IKnownHostMatchResult {
  if (candidates.length === 0) {
    return { verdict: 'unknown' };
  }
  if (candidates.some((row) => row.fingerprint === fingerprint)) {
    return { verdict: 'trusted' };
  }
  const sameType = candidates.find((row) => row.keyType === keyType);
  if (sameType) {
    return { verdict: 'changed', existing: sameType };
  }
  return { verdict: 'unknown' };
}

export class KnownHostRepository extends Disposable {
  private readonly _changed$ = new Subject<IKnownHostChangeEvent>();
  readonly changed$ = this._changed$.asObservable();

  constructor(
    @IDBAdaptorService private readonly _dbService: IDBAdaptorService
  ) {
    super();
  }

  private get _db() {
    return this._dbService.db as BetterSQLite3Database<typeof schema>;
  }

  async getList(): Promise<IKnownHostEntity[]> {
    return this._db.select().from(knownHostEntity);
  }

  async findByHostPort(host: string, port: number): Promise<IKnownHostEntity[]> {
    return this._db
      .select()
      .from(knownHostEntity)
      .where(and(eq(knownHostEntity.host, host), eq(knownHostEntity.port, port)));
  }

  // TOFU classification (read-only). Decision logic lives in classifyKnownHost.
  async classify(host: string, port: number, keyType: string, fingerprint: string): Promise<IKnownHostMatchResult> {
    const candidates = await this.findByHostPort(host, port);
    return classifyKnownHost(candidates, keyType, fingerprint);
  }

  // Inserts a new (host, port, keyType) record or refreshes an existing one's fingerprint.
  async upsert(record: IKnownHostUpsert): Promise<string> {
    const now = new Date().toISOString();
    const existing = (await this.findByHostPort(record.host, record.port)).find(
      (row) => row.keyType === record.keyType
    );
    if (existing) {
      await this._db
        .update(knownHostEntity)
        .set({ fingerprint: record.fingerprint, publicKey: record.publicKey ?? null, lastSeenAt: now, updatedAt: now })
        .where(eq(knownHostEntity.id, existing.id));
      this._changed$.next({ type: 'update', id: existing.id });
      return existing.id;
    }
    const id = generateId();
    const payload: IKnownHostEntityInsert = {
      id,
      host: record.host,
      port: record.port,
      keyType: record.keyType,
      fingerprint: record.fingerprint,
      publicKey: record.publicKey ?? null,
      lastSeenAt: now,
    };
    await this._db.insert(knownHostEntity).values(payload);
    this._changed$.next({ type: 'add', id });
    return id;
  }

  async touchLastSeen(host: string, port: number, fingerprint: string): Promise<void> {
    const now = new Date().toISOString();
    await this._db
      .update(knownHostEntity)
      .set({ lastSeenAt: now })
      .where(
        and(
          eq(knownHostEntity.host, host),
          eq(knownHostEntity.port, port),
          eq(knownHostEntity.fingerprint, fingerprint)
        )
      );
  }

  async delete(id: string): Promise<void> {
    await this._db.delete(knownHostEntity).where(eq(knownHostEntity.id, id));
    this._changed$.next({ type: 'delete', id });
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this._db.delete(knownHostEntity).where(inArray(knownHostEntity.id, ids));
    ids.forEach((id) => this._changed$.next({ type: 'delete', id }));
  }
}
