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

import type { ISshKeySyncRepository } from '@termlnk/sync';
import type { ISshKeyChangeEvent } from '@termlnk/terminal';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../entities';
import type { ISshKeyEntity, ISshKeyEntityInsert } from '../entities';
import { Disposable, Inject } from '@termlnk/core';
import { eq } from 'drizzle-orm';
import { Subject } from 'rxjs';
import { generateId } from '../entities/base';
import { sshKeyEntity } from '../entities/ssh-key';
import { IDBAdaptorService } from '../services/db-adaptor.service';
import { ISecretCipherService } from '../services/secret-cipher.service';
import { decryptIfNeeded, encryptIfNeeded } from '../services/secret-cipher/credential-masker';
import { IdentityRepository } from './identity';

export class SshKeyRepository extends Disposable implements ISshKeySyncRepository {
  private readonly _changed$ = new Subject<ISshKeyChangeEvent>();
  readonly changed$ = this._changed$.asObservable();

  constructor(
    @IDBAdaptorService private readonly _dbService: IDBAdaptorService,
    @ISecretCipherService private readonly _cipher: ISecretCipherService,
    @Inject(IdentityRepository) private readonly _identityRepo: IdentityRepository
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

  // Repository-level referential integrity: clears identity.keyId before the row
  // disappears so neither UI router nor sync apply can leave dangling identity refs.
  // host.credential references are JSON blobs and are not cleared here — the UI surfaces
  // dangling host refs on the next edit.
  async delete(id: string): Promise<void> {
    const referrers = await this._identityRepo.getReferrersByKeyId(id);
    for (const referrer of referrers) {
      await this._identityRepo.update(referrer.id, { keyId: null });
    }
    await this._db.delete(sshKeyEntity).where(eq(sshKeyEntity.id, id));
    this._changed$.next({ type: 'delete', id });
  }

  // Sync apply path: deletes the row without the identity.keyId cascade. The originating
  // device already syncs the cascaded identity change, so re-cascading here would make the
  // IdentitySynchroniser re-push it as a spurious local mutation.
  async syncDeleteRow(id: string): Promise<void> {
    await this._db.delete(sshKeyEntity).where(eq(sshKeyEntity.id, id));
    this._changed$.next({ type: 'delete', id });
  }

  // Sync write path: applies a row verbatim. Skips update()'s "empty privateKey = keep"
  // and "savePassphrase=false clears passphrase" shortcuts, which would corrupt LWW.
  async syncUpsertRow(entity: ISshKeyEntity): Promise<void> {
    const encrypted: ISshKeyEntity = {
      ...entity,
      privateKey: encryptIfNeeded(entity.privateKey, this._cipher),
      passphrase: encryptIfNeeded(entity.passphrase, this._cipher),
    };
    const existing = await this._db
      .select({ id: sshKeyEntity.id })
      .from(sshKeyEntity)
      .where(eq(sshKeyEntity.id, entity.id))
      .limit(1);
    if (existing.length > 0) {
      await this._db.update(sshKeyEntity).set(encrypted).where(eq(sshKeyEntity.id, entity.id));
      this._changed$.next({ type: 'update', id: entity.id });
    } else {
      await this._db.insert(sshKeyEntity).values(encrypted);
      this._changed$.next({ type: 'add', id: entity.id });
    }
  }
}
