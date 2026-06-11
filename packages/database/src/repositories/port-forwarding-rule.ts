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

import type { IPortForwardingRuleSyncRepository, ISyncRowChangeEvent } from '@termlnk/sync';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../entities';
import type { IPortForwardingRuleEntity, IPortForwardingRuleEntityInsert } from '../entities';
import { Disposable } from '@termlnk/core';
import { eq } from 'drizzle-orm';
import { Subject } from 'rxjs';
import { generateId } from '../entities/base';
import { portForwardingRuleEntity } from '../entities/port-forwarding-rule';
import { IDBAdaptorService } from '../services/db-adaptor.service';

export class PortForwardingRuleRepository extends Disposable implements IPortForwardingRuleSyncRepository {
  private readonly _changed$ = new Subject<ISyncRowChangeEvent>();
  readonly changed$ = this._changed$.asObservable();

  constructor(
    @IDBAdaptorService private readonly _dbService: IDBAdaptorService
  ) {
    super();
  }

  override dispose(): void {
    super.dispose();
    this._changed$.complete();
  }

  private get _db() {
    return this._dbService.db as BetterSQLite3Database<typeof schema>;
  }

  async getList(): Promise<IPortForwardingRuleEntity[]> {
    return this._db.select().from(portForwardingRuleEntity);
  }

  async getById(id: string): Promise<IPortForwardingRuleEntity | undefined> {
    const result = await this._db.select().from(portForwardingRuleEntity).where(eq(portForwardingRuleEntity.id, id)).limit(1);
    return result[0];
  }

  async create(record: Omit<IPortForwardingRuleEntityInsert, 'id'> & { id?: string }): Promise<string> {
    const id = record.id || generateId();
    await this._db.insert(portForwardingRuleEntity).values({ ...record, id });
    this._changed$.next({ type: 'add', id });
    return id;
  }

  async update(id: string, updates: Partial<Omit<IPortForwardingRuleEntityInsert, 'id'>>): Promise<void> {
    await this._db.update(portForwardingRuleEntity).set({
      ...updates,
      updatedAt: new Date().toISOString(),
    }).where(eq(portForwardingRuleEntity.id, id));
    this._changed$.next({ type: 'update', id });
  }

  async delete(id: string): Promise<void> {
    await this._db.delete(portForwardingRuleEntity).where(eq(portForwardingRuleEntity.id, id));
    this._changed$.next({ type: 'delete', id });
  }

  async syncUpsertRow(entity: IPortForwardingRuleEntity): Promise<void> {
    const existing = await this._db
      .select({ id: portForwardingRuleEntity.id })
      .from(portForwardingRuleEntity)
      .where(eq(portForwardingRuleEntity.id, entity.id))
      .limit(1);
    if (existing.length > 0) {
      await this._db.update(portForwardingRuleEntity).set(entity).where(eq(portForwardingRuleEntity.id, entity.id));
      this._changed$.next({ type: 'update', id: entity.id });
    } else {
      await this._db.insert(portForwardingRuleEntity).values(entity);
      this._changed$.next({ type: 'add', id: entity.id });
    }
  }
}
