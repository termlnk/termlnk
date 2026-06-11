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

import type { ISnippetSyncRepository, ISyncRowChangeEvent } from '@termlnk/sync';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../entities';
import type { ISnippetEntity, ISnippetEntityInsert } from '../entities';
import { Disposable } from '@termlnk/core';
import { eq } from 'drizzle-orm';
import { Subject } from 'rxjs';
import { generateId } from '../entities/base';
import { snippetEntity } from '../entities/snippet';
import { IDBAdaptorService } from '../services/db-adaptor.service';
import { ISecretCipherService } from '../services/secret-cipher.service';
import { decryptIfNeeded, encryptIfNeeded } from '../services/secret-cipher/credential-masker';

export class SnippetRepository extends Disposable implements ISnippetSyncRepository {
  private readonly _changed$ = new Subject<ISyncRowChangeEvent>();
  readonly changed$ = this._changed$.asObservable();

  constructor(
    @IDBAdaptorService private readonly _dbService: IDBAdaptorService,
    @ISecretCipherService private readonly _cipher: ISecretCipherService
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

  private _decryptEntity(entity: ISnippetEntity): ISnippetEntity {
    return {
      ...entity,
      command: decryptIfNeeded(entity.command, this._cipher),
    };
  }

  private _encryptEntity(entity: ISnippetEntity): ISnippetEntity {
    return {
      ...entity,
      command: encryptIfNeeded(entity.command, this._cipher),
    };
  }

  async getList(): Promise<ISnippetEntity[]> {
    const rows = await this._db.select().from(snippetEntity);
    return rows.map((row) => this._decryptEntity(row));
  }

  async getById(id: string): Promise<ISnippetEntity | undefined> {
    const result = await this._db.select().from(snippetEntity).where(eq(snippetEntity.id, id)).limit(1);
    return result[0] ? this._decryptEntity(result[0]) : undefined;
  }

  async create(record: Omit<ISnippetEntityInsert, 'id'> & { id?: string }): Promise<string> {
    const id = record.id || generateId();
    const payload: ISnippetEntityInsert = {
      ...record,
      id,
      command: encryptIfNeeded(record.command, this._cipher),
    };
    await this._db.insert(snippetEntity).values(payload);
    this._changed$.next({ type: 'add', id });
    return id;
  }

  async update(id: string, updates: Partial<Omit<ISnippetEntityInsert, 'id'>>): Promise<void> {
    const payload: Partial<Omit<ISnippetEntityInsert, 'id'>> & { updatedAt: string } = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    if (Object.hasOwn(updates, 'command')) {
      payload.command = updates.command == null ? updates.command : encryptIfNeeded(updates.command, this._cipher);
    }
    await this._db.update(snippetEntity).set(payload).where(eq(snippetEntity.id, id));
    this._changed$.next({ type: 'update', id });
  }

  async delete(id: string): Promise<void> {
    await this._db.delete(snippetEntity).where(eq(snippetEntity.id, id));
    this._changed$.next({ type: 'delete', id });
  }

  async syncUpsertRow(entity: ISnippetEntity): Promise<void> {
    const encrypted = this._encryptEntity(entity);
    const existing = await this._db
      .select({ id: snippetEntity.id })
      .from(snippetEntity)
      .where(eq(snippetEntity.id, entity.id))
      .limit(1);
    if (existing.length > 0) {
      await this._db.update(snippetEntity).set(encrypted).where(eq(snippetEntity.id, entity.id));
      this._changed$.next({ type: 'update', id: entity.id });
    } else {
      await this._db.insert(snippetEntity).values(encrypted);
      this._changed$.next({ type: 'add', id: entity.id });
    }
  }
}
