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

import type { IMcpServerChangeEvent, McpConnectionStatus } from '@termlnk/agent';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../entities';
import type { IMcpServerEntity, IMcpServerEntityInsert } from '../entities';
import { Disposable, Inject } from '@termlnk/core';
import { eq } from 'drizzle-orm';
import { Subject } from 'rxjs';
import { generateId } from '../entities/base';
import { mcpServerEntity } from '../entities/mcp-server';
import { IDBAdaptorService } from '../services/db-adaptor.service';

export class McpServerRepository extends Disposable {
  private readonly _changed$ = new Subject<IMcpServerChangeEvent>();
  readonly changed$ = this._changed$.asObservable();

  constructor(
    @Inject(IDBAdaptorService) private readonly _dbService: IDBAdaptorService
  ) {
    super();
  }

  private get _db() {
    return this._dbService.db as BetterSQLite3Database<typeof schema>;
  }

  async getAll(): Promise<IMcpServerEntity[]> {
    return this._db.select().from(mcpServerEntity);
  }

  async getById(id: string): Promise<IMcpServerEntity | undefined> {
    const result = await this._db.select().from(mcpServerEntity).where(eq(mcpServerEntity.id, id)).limit(1);
    return result[0];
  }

  async getEnabled(): Promise<IMcpServerEntity[]> {
    return this._db.select().from(mcpServerEntity).where(eq(mcpServerEntity.enabled, true));
  }

  async create(record: Omit<IMcpServerEntityInsert, 'id'> & { id?: string }): Promise<string> {
    const id = record.id || generateId();
    await this._db.insert(mcpServerEntity).values({ ...record, id });
    this._changed$.next({ type: 'add', id });
    return id;
  }

  async update(id: string, updates: Partial<Omit<IMcpServerEntityInsert, 'id'>>): Promise<void> {
    await this._db
      .update(mcpServerEntity)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(mcpServerEntity.id, id));
    this._changed$.next({ type: 'update', id });
  }

  async delete(id: string): Promise<void> {
    await this._db.delete(mcpServerEntity).where(eq(mcpServerEntity.id, id));
    this._changed$.next({ type: 'delete', id });
  }

  async updateStatus(id: string, status: McpConnectionStatus, lastError?: string): Promise<void> {
    await this._db
      .update(mcpServerEntity)
      .set({ status, lastError: lastError ?? null, updatedAt: new Date().toISOString() })
      .where(eq(mcpServerEntity.id, id));
    this._changed$.next({ type: 'update', id });
  }

  async updateToolCount(id: string, toolCount: number, resourceCount?: number): Promise<void> {
    const updates: Partial<IMcpServerEntityInsert> = {
      toolCount,
      updatedAt: new Date().toISOString(),
    };
    if (resourceCount !== undefined) {
      updates.resourceCount = resourceCount;
    }
    await this._db
      .update(mcpServerEntity)
      .set(updates)
      .where(eq(mcpServerEntity.id, id));
    this._changed$.next({ type: 'update', id });
  }

  async updateEnabled(id: string, enabled: boolean): Promise<void> {
    await this._db
      .update(mcpServerEntity)
      .set({ enabled, updatedAt: new Date().toISOString() })
      .where(eq(mcpServerEntity.id, id));
    this._changed$.next({ type: 'update', id });
  }
}
