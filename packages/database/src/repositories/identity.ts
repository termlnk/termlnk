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

import type { IIdentityChangeEvent } from '@termlnk/terminal';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../entities';
import type { IIdentityEntity, IIdentityEntityInsert } from '../entities';
import { Disposable } from '@termlnk/core';
import { eq } from 'drizzle-orm';
import { Subject } from 'rxjs';
import { generateId } from '../entities/base';
import { identityEntity } from '../entities/identity';
import { IDBAdaptorService } from '../services/db-adaptor.service';
import { ISecretCipherService } from '../services/secret-cipher.service';
import { decryptIfNeeded, encryptIfNeeded } from '../services/secret-cipher/credential-masker';

export class IdentityRepository extends Disposable {
  private readonly _changed$ = new Subject<IIdentityChangeEvent>();
  readonly changed$ = this._changed$.asObservable();

  constructor(
    @IDBAdaptorService private readonly _dbService: IDBAdaptorService,
    @ISecretCipherService private readonly _cipher: ISecretCipherService
  ) {
    super();
  }

  private get _db() {
    return this._dbService.db as BetterSQLite3Database<typeof schema>;
  }

  private _decryptEntity(entity: IIdentityEntity): IIdentityEntity {
    return {
      ...entity,
      password: decryptIfNeeded(entity.password, this._cipher),
    };
  }

  async getList(): Promise<IIdentityEntity[]> {
    const rows = await this._db.select().from(identityEntity);
    return rows.map((row) => this._decryptEntity(row));
  }

  async getById(id: string): Promise<IIdentityEntity | undefined> {
    const result = await this._db.select().from(identityEntity).where(eq(identityEntity.id, id)).limit(1);
    return result[0] ? this._decryptEntity(result[0]) : undefined;
  }

  /** Identities that reference a given key, used before deleting that key. */
  async getReferrersByKeyId(keyId: string): Promise<IIdentityEntity[]> {
    const rows = await this._db.select().from(identityEntity).where(eq(identityEntity.keyId, keyId));
    return rows.map((row) => this._decryptEntity(row));
  }

  async create(record: Omit<IIdentityEntityInsert, 'id'> & { id?: string }): Promise<string> {
    const id = record.id || generateId();
    const payload: IIdentityEntityInsert = {
      ...record,
      id,
      password: encryptIfNeeded(record.password, this._cipher),
    };
    await this._db.insert(identityEntity).values(payload);
    this._changed$.next({ type: 'add', id });
    return id;
  }

  // Empty password preserves the stored value (the renderer never receives the plaintext
  // password and submits "" to mean "unchanged").
  async update(id: string, updates: Partial<Omit<IIdentityEntityInsert, 'id'>>): Promise<void> {
    const payload: Partial<Omit<IIdentityEntityInsert, 'id'>> & { updatedAt: string } = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    if (Object.hasOwn(updates, 'password') && updates.password) {
      payload.password = encryptIfNeeded(updates.password, this._cipher);
    } else {
      delete payload.password;
    }
    await this._db.update(identityEntity).set(payload).where(eq(identityEntity.id, id));
    this._changed$.next({ type: 'update', id });
  }

  async delete(id: string): Promise<void> {
    await this._db.delete(identityEntity).where(eq(identityEntity.id, id));
    this._changed$.next({ type: 'delete', id });
  }
}
