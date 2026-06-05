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
import { createHash } from 'node:crypto';
import { Disposable } from '@termlnk/core';
import { and, eq, inArray } from 'drizzle-orm';
import { Subject } from 'rxjs';
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

// Deterministic id derived from the protocol-level natural key. SSH treats
// (host, port, keyType) as the unique identity of a trust record; making that the id
// lets two devices' sync streams converge on a single row instead of diverging into
// duplicates. The 96-bit hex prefix is opaque on the wire and collision-free at any
// realistic user scale.
export function makeKnownHostId(host: string, port: number, keyType: string): string {
  return `kh_${createHash('sha256').update(`${host}|${port}|${keyType}`).digest('hex').slice(0, 24)}`;
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

  async getById(id: string): Promise<IKnownHostEntity | undefined> {
    const rows = await this._db.select().from(knownHostEntity).where(eq(knownHostEntity.id, id)).limit(1);
    return rows[0];
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
  // The id is derived from the natural key, so the same trust record on different devices
  // gets the same id — sync converges instead of producing duplicate rows.
  async upsert(record: IKnownHostUpsert): Promise<string> {
    const now = new Date().toISOString();
    const id = makeKnownHostId(record.host, record.port, record.keyType);
    const existed = !!(await this.getById(id));
    const payload: IKnownHostEntityInsert = {
      id,
      host: record.host,
      port: record.port,
      keyType: record.keyType,
      fingerprint: record.fingerprint,
      publicKey: record.publicKey ?? null,
      lastSeenAt: now,
    };
    await this._db
      .insert(knownHostEntity)
      .values(payload)
      .onConflictDoUpdate({
        target: knownHostEntity.id,
        set: { fingerprint: record.fingerprint, publicKey: record.publicKey ?? null, lastSeenAt: now, updatedAt: now },
      });
    this._changed$.next({ type: existed ? 'update' : 'add', id });
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

  // Sync write path: applies a row verbatim. Skips upsert()'s TOFU matching by
  // (host, port, keyType), which would mint a new local id and corrupt LWW.
  async syncUpsertRow(entity: IKnownHostEntity): Promise<void> {
    const existing = await this._db
      .select({ id: knownHostEntity.id })
      .from(knownHostEntity)
      .where(eq(knownHostEntity.id, entity.id))
      .limit(1);
    if (existing.length > 0) {
      await this._db.update(knownHostEntity).set(entity).where(eq(knownHostEntity.id, entity.id));
      this._changed$.next({ type: 'update', id: entity.id });
    } else {
      await this._db.insert(knownHostEntity).values(entity);
      this._changed$.next({ type: 'add', id: entity.id });
    }
  }
}
