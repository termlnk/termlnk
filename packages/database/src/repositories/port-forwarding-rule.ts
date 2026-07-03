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
import type { IPortForwardingRuleEntity, IPortForwardingRuleEntityInsert, PortForwardingType } from '../entities';
import { Disposable } from '@termlnk/core';
import { eq, sql } from 'drizzle-orm';
import { Subject } from 'rxjs';
import { generateId } from '../entities/base';
import { portForwardingRuleEntity } from '../entities/port-forwarding-rule';
import { IDBAdaptorService } from '../services/db-adaptor.service';

export interface IPortForwardingRuleCreate {
  label?: string;
  type: PortForwardingType;
  hostId: string;
  bindAddress?: string;
  bindPort: number;
  destinationAddress?: string | null;
  destinationPort?: number | null;
  sort?: number;
}

export interface IPortForwardingRuleUpdate {
  label?: string;
  type?: PortForwardingType;
  hostId?: string;
  bindAddress?: string;
  bindPort?: number;
  destinationAddress?: string | null;
  destinationPort?: number | null;
  sort?: number;
}

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
    return this._db.select().from(portForwardingRuleEntity).orderBy(portForwardingRuleEntity.sort);
  }

  async getById(id: string): Promise<IPortForwardingRuleEntity | undefined> {
    const rows = await this._db
      .select()
      .from(portForwardingRuleEntity)
      .where(eq(portForwardingRuleEntity.id, id))
      .limit(1);
    return rows[0];
  }

  async create(input: IPortForwardingRuleCreate): Promise<IPortForwardingRuleEntity> {
    const id = generateId();
    const sort = input.sort ?? (await this._maxSort()) + 1;
    const row: IPortForwardingRuleEntityInsert = {
      id,
      label: input.label ?? '',
      type: input.type,
      hostId: input.hostId,
      bindAddress: input.bindAddress ?? '127.0.0.1',
      bindPort: input.bindPort,
      destinationAddress: input.destinationAddress ?? null,
      destinationPort: input.destinationPort ?? null,
      sort,
    };
    await this._db.insert(portForwardingRuleEntity).values(row);
    const created = await this.getById(id);
    if (!created) {
      throw new Error(`Failed to create port forwarding rule ${id}`);
    }
    this._changed$.next({ type: 'add', id });
    return created;
  }

  async update(id: string, patch: IPortForwardingRuleUpdate): Promise<IPortForwardingRuleEntity> {
    const updates: Partial<IPortForwardingRuleEntityInsert> = {};
    if (patch.label !== undefined) {
      updates.label = patch.label;
    }
    if (patch.type !== undefined) {
      updates.type = patch.type;
    }
    if (patch.hostId !== undefined) {
      updates.hostId = patch.hostId;
    }
    if (patch.bindAddress !== undefined) {
      updates.bindAddress = patch.bindAddress;
    }
    if (patch.bindPort !== undefined) {
      updates.bindPort = patch.bindPort;
    }
    if (patch.destinationAddress !== undefined) {
      updates.destinationAddress = patch.destinationAddress;
    }
    if (patch.destinationPort !== undefined) {
      updates.destinationPort = patch.destinationPort;
    }
    if (patch.sort !== undefined) {
      updates.sort = patch.sort;
    }

    if (Object.keys(updates).length === 0) {
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error(`Port forwarding rule ${id} not found`);
      }
      return existing;
    }

    await this._db.update(portForwardingRuleEntity).set(updates).where(eq(portForwardingRuleEntity.id, id));
    const updated = await this.getById(id);
    if (!updated) {
      throw new Error(`Port forwarding rule ${id} not found after update`);
    }
    this._changed$.next({ type: 'update', id });
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this._db.delete(portForwardingRuleEntity).where(eq(portForwardingRuleEntity.id, id));
    this._changed$.next({ type: 'delete', id });
  }

  // Sync write path: applies a remote row verbatim. Skips the local
  // auto-id / auto-sort behaviour because the row already has its identity.
  async syncUpsertRow(entity: IPortForwardingRuleEntity): Promise<void> {
    const existing = await this._db
      .select({ id: portForwardingRuleEntity.id })
      .from(portForwardingRuleEntity)
      .where(eq(portForwardingRuleEntity.id, entity.id))
      .limit(1);

    if (existing.length > 0) {
      await this._db
        .update(portForwardingRuleEntity)
        .set(entity)
        .where(eq(portForwardingRuleEntity.id, entity.id));
      this._changed$.next({ type: 'update', id: entity.id });
    } else {
      await this._db.insert(portForwardingRuleEntity).values(entity);
      this._changed$.next({ type: 'add', id: entity.id });
    }
  }

  private async _maxSort(): Promise<number> {
    const result = await this._db
      .select({ max: sql<number>`COALESCE(MAX(${portForwardingRuleEntity.sort}), 0)` })
      .from(portForwardingRuleEntity);
    return result[0]?.max ?? 0;
  }
}
