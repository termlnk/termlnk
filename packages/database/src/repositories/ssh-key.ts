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

import type { ISshKeyChangeEvent } from '@termlnk/terminal';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../entities';
import type { ISshKeyEntity, ISshKeyEntityInsert } from '../entities';
import { Disposable } from '@termlnk/core';
import { eq } from 'drizzle-orm';
import { Subject } from 'rxjs';
import { generateId } from '../entities/base';
import { sshKeyEntity } from '../entities/ssh-key';
import { IDBAdaptorService } from '../services/db-adaptor.service';
import { ISecretCipherService } from '../services/secret-cipher.service';
import { decryptIfNeeded, encryptIfNeeded } from '../services/secret-cipher/credential-masker';

export class SshKeyRepository extends Disposable {
  private readonly _changed$ = new Subject<ISshKeyChangeEvent>();
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

  private _decryptEntity(entity: ISshKeyEntity): ISshKeyEntity {
    return {
      ...entity,
      privateKey: decryptIfNeeded(entity.privateKey, this._cipher),
      passphrase: decryptIfNeeded(entity.passphrase, this._cipher),
    };
  }

  async getList(): Promise<ISshKeyEntity[]> {
    const rows = await this._db.select().from(sshKeyEntity);
    return rows.map((row) => this._decryptEntity(row));
  }

  async getById(id: string): Promise<ISshKeyEntity | undefined> {
    const result = await this._db.select().from(sshKeyEntity).where(eq(sshKeyEntity.id, id)).limit(1);
    return result[0] ? this._decryptEntity(result[0]) : undefined;
  }

  async create(record: Omit<ISshKeyEntityInsert, 'id'> & { id?: string }): Promise<string> {
    const id = record.id || generateId();
    const payload: ISshKeyEntityInsert = {
      ...record,
      id,
      privateKey: encryptIfNeeded(record.privateKey, this._cipher),
      passphrase: encryptIfNeeded(record.passphrase, this._cipher),
    };
    await this._db.insert(sshKeyEntity).values(payload);
    this._changed$.next({ type: 'add', id });
    return id;
  }

  // Empty privateKey preserves the stored value (the renderer never receives plaintext
  // secrets and submits "" to mean "unchanged"). Turning savePassphrase off clears the
  // stored passphrase so it can be revoked.
  async update(id: string, updates: Partial<Omit<ISshKeyEntityInsert, 'id'>>): Promise<void> {
    const payload: Partial<Omit<ISshKeyEntityInsert, 'id'>> & { updatedAt: string } = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    if (Object.hasOwn(updates, 'privateKey') && updates.privateKey) {
      payload.privateKey = encryptIfNeeded(updates.privateKey, this._cipher);
    } else {
      delete payload.privateKey;
    }
    if (updates.savePassphrase === false) {
      payload.passphrase = null;
    } else if (Object.hasOwn(updates, 'passphrase') && updates.passphrase) {
      payload.passphrase = encryptIfNeeded(updates.passphrase, this._cipher);
    } else {
      delete payload.passphrase;
    }
    await this._db.update(sshKeyEntity).set(payload).where(eq(sshKeyEntity.id, id));
    this._changed$.next({ type: 'update', id });
  }

  async delete(id: string): Promise<void> {
    await this._db.delete(sshKeyEntity).where(eq(sshKeyEntity.id, id));
    this._changed$.next({ type: 'delete', id });
  }
}
