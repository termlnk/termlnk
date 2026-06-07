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

import type { ISkillChangeEvent } from '@termlnk/agent';
import type { ISkillSyncRepository } from '@termlnk/sync';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../entities';
import type { ISkillEntity, ISkillEntityInsert } from '../entities';
import { Disposable } from '@termlnk/core';
import { eq } from 'drizzle-orm';
import { Subject } from 'rxjs';
import { generateId } from '../entities/base';
import { skillEntity } from '../entities/skill';
import { IDBAdaptorService } from '../services/db-adaptor.service';

export class SkillRepository extends Disposable implements ISkillSyncRepository {
  private readonly _changed$ = new Subject<ISkillChangeEvent>();
  readonly changed$ = this._changed$.asObservable();

  constructor(
    @IDBAdaptorService private readonly _dbService: IDBAdaptorService
  ) {
    super();
  }

  private get _db() {
    return this._dbService.db as BetterSQLite3Database<typeof schema>;
  }

  async getAll(): Promise<ISkillEntity[]> {
    return this._db.select().from(skillEntity);
  }

  async getById(id: string): Promise<ISkillEntity | undefined> {
    const result = await this._db.select().from(skillEntity).where(eq(skillEntity.id, id)).limit(1);
    return result[0];
  }

  async getByName(name: string): Promise<ISkillEntity | undefined> {
    const result = await this._db.select().from(skillEntity).where(eq(skillEntity.name, name)).limit(1);
    return result[0];
  }

  async getEnabled(): Promise<ISkillEntity[]> {
    return this._db.select().from(skillEntity).where(eq(skillEntity.enabled, true));
  }

  async create(record: Omit<ISkillEntityInsert, 'id'> & { id?: string }): Promise<string> {
    const id = record.id || generateId();
    await this._db.insert(skillEntity).values({ ...record, id });
    this._changed$.next({ type: 'add', id });
    return id;
  }

  async update(id: string, updates: Partial<Omit<ISkillEntityInsert, 'id'>>): Promise<void> {
    await this._db
      .update(skillEntity)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(skillEntity.id, id));
    this._changed$.next({ type: 'update', id });
  }

  async delete(id: string): Promise<void> {
    await this._db.delete(skillEntity).where(eq(skillEntity.id, id));
    this._changed$.next({ type: 'delete', id });
  }

  async updateEnabled(id: string, enabled: boolean): Promise<void> {
    await this._db
      .update(skillEntity)
      .set({ enabled, updatedAt: new Date().toISOString() })
      .where(eq(skillEntity.id, id));
    this._changed$.next({ type: 'update', id });
  }

  async updateSortOrder(id: string, sortOrder: number): Promise<void> {
    await this._db
      .update(skillEntity)
      .set({ sortOrder, updatedAt: new Date().toISOString() })
      .where(eq(skillEntity.id, id));
    this._changed$.next({ type: 'update', id });
  }

  async upsert(record: ISkillEntityInsert): Promise<string> {
    await this._db
      .insert(skillEntity)
      .values(record)
      .onConflictDoUpdate({
        target: skillEntity.id,
        set: {
          name: record.name,
          path: record.path,
          source: record.source,
          registryId: record.registryId,
          version: record.version,
          enabled: record.enabled,
          sortOrder: record.sortOrder,
          checksum: record.checksum,
          updatedAt: new Date().toISOString(),
        },
      });
    this._changed$.next({ type: 'update', id: record.id });
    return record.id;
  }
}
