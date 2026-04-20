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
import type { IConfigChangeEvent, IConfigEntry } from '../models/config';
import { Disposable } from '@termlnk/core';
import { eq, inArray } from 'drizzle-orm';
import { Subject } from 'rxjs';
import { configEntity } from '../entities/config';
import { IDBAdaptorService } from '../services/db-adaptor.service';

export class ConfigRepository extends Disposable {
  private readonly _changed$ = new Subject<IConfigChangeEvent>();
  readonly changed$ = this._changed$.asObservable();

  constructor(
    @IDBAdaptorService private readonly _dbService: IDBAdaptorService
  ) {
    super();
  }

  private get _db() {
    return this._dbService.db as BetterSQLite3Database<typeof schema>;
  }

  private async _resolveObj(key: string): Promise<Record<string, unknown>> {
    const existing = await this.get<Record<string, unknown>>(key);
    return (existing && typeof existing === 'object') ? { ...existing } : {};
  }

  private async _rawSet(key: string, value: unknown): Promise<void> {
    await this._db
      .insert(configEntity)
      .values({ key, value, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: configEntity.key,
        set: { value, updatedAt: new Date().toISOString() },
      });
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const rows = await this._db
      .select()
      .from(configEntity)
      .where(eq(configEntity.key, key))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    return rows[0].value as T;
  }

  async getMany(keys: string[]): Promise<Record<string, unknown>> {
    if (keys.length === 0) {
      return {};
    }

    const rows = await this._db
      .select()
      .from(configEntity)
      .where(inArray(configEntity.key, keys));

    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }

    return result;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this._rawSet(key, value);
    this._changed$.next({ type: 'set', key });
  }

  async getField<T = unknown>(key: string, field: string): Promise<T | null> {
    const row = await this.get<Record<string, unknown>>(key);
    if (!row || typeof row !== 'object') {
      return null;
    }
    return (row[field] ?? null) as T | null;
  }

  async setField(key: string, field: string, value: unknown): Promise<void> {
    const obj = await this._resolveObj(key);
    obj[field] = value;
    await this._rawSet(key, obj);
    this._changed$.next({ type: 'set', key, subKey: field });
  }

  async deleteField(key: string, field: string): Promise<void> {
    const existing = await this.get<Record<string, unknown>>(key);
    if (!existing || typeof existing !== 'object') {
      return;
    }
    const obj = { ...existing };
    delete obj[field];
    await this._rawSet(key, obj);
    this._changed$.next({ type: 'delete', key, subKey: field });
  }

  async setMany(entries: IConfigEntry[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    for (const entry of entries) {
      await this._rawSet(entry.key, entry.value);
    }

    for (const entry of entries) {
      this._changed$.next({ type: 'set', key: entry.key });
    }
  }

  async delete(key: string): Promise<void> {
    await this._db
      .delete(configEntity)
      .where(eq(configEntity.key, key));

    this._changed$.next({ type: 'delete', key });
  }

  async getAll(): Promise<IConfigEntry[]> {
    const rows = await this._db
      .select()
      .from(configEntity);

    return rows.map((row) => ({
      key: row.key,
      value: row.value,
    }));
  }
}
