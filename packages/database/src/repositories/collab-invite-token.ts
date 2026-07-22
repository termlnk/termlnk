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

import type { ICollabInviteTokenEntity, ICollabInviteTokenEntityInsert } from '../entities/collab-invite-token';
import { Disposable } from '@termlnk/core';
import { and, asc, eq, inArray, lt, sql } from 'drizzle-orm';
import { Subject } from 'rxjs';
import { collabInviteTokenEntity } from '../entities/collab-invite-token';
import { IDBAdaptorService } from '../services/db-adaptor.service';
import { ISecretCipherService } from '../services/secret-cipher.service';
import { decryptIfNeeded, encryptIfNeeded } from '../services/secret-cipher/credential-masker';

export type CollabInviteStatus = 'active' | 'consumed' | 'revoked' | 'expired';

export interface ICollabInviteChangeEvent {
  readonly action: 'insert' | 'update' | 'delete';
  readonly inviteId: string;
}

/**
 * collab_invite_token data access. Transparent encrypt/decrypt of the ephemeral private key
 * via ISecretCipherService — at-rest data on disk never reveals the X25519 secret.
 *
 * No business orchestration here (lifecycle transitions, server-side push, expiry sweep)
 * — those live in PairingService.
 */
export class CollabInviteTokenRepository extends Disposable {
  private readonly _changed$ = new Subject<ICollabInviteChangeEvent>();
  readonly changed$ = this._changed$.asObservable();

  constructor(
    @IDBAdaptorService private readonly _dbService: IDBAdaptorService,
    @ISecretCipherService private readonly _cipher: ISecretCipherService
  ) {
    super();
  }

  override dispose(): void {
    this._changed$.complete();
    super.dispose();
  }

  private get _db() {
    return this._dbService.db;
  }

  private _decryptRow(row: ICollabInviteTokenEntity): ICollabInviteTokenEntity {
    return {
      ...row,
      ephPrivCipher: decryptIfNeeded(row.ephPrivCipher, this._cipher),
    };
  }

  async insert(record: ICollabInviteTokenEntityInsert): Promise<ICollabInviteTokenEntity> {
    const payload: ICollabInviteTokenEntityInsert = {
      ...record,
      ephPrivCipher: encryptIfNeeded(record.ephPrivCipher, this._cipher),
    };
    const [inserted] = await this._db
      .insert(collabInviteTokenEntity)
      .values(payload)
      .returning();
    this._changed$.next({ action: 'insert', inviteId: record.inviteId });
    return this._decryptRow(inserted);
  }

  async getById(inviteId: string): Promise<ICollabInviteTokenEntity | null> {
    const rows = await this._db
      .select()
      .from(collabInviteTokenEntity)
      .where(eq(collabInviteTokenEntity.inviteId, inviteId))
      .limit(1);
    return rows[0] ? this._decryptRow(rows[0]) : null;
  }

  /** All invites that are still meaningful to the owner UI's "outstanding" pane (active only). */
  async listOutstanding(): Promise<ICollabInviteTokenEntity[]> {
    const rows = await this._db
      .select()
      .from(collabInviteTokenEntity)
      .where(eq(collabInviteTokenEntity.status, 'active' as CollabInviteStatus))
      .orderBy(asc(collabInviteTokenEntity.createdAt));
    return rows.map((row) => this._decryptRow(row));
  }

  /** All invites regardless of status; used by the history pane and reconciliation sweep. */
  async listAll(): Promise<ICollabInviteTokenEntity[]> {
    const rows = await this._db
      .select()
      .from(collabInviteTokenEntity)
      .orderBy(asc(collabInviteTokenEntity.createdAt));
    return rows.map((row) => this._decryptRow(row));
  }

  /** Returns active invites whose `exp` is in the past — startup expiry sweep input. */
  async listExpiredActive(now: number): Promise<ICollabInviteTokenEntity[]> {
    const rows = await this._db
      .select()
      .from(collabInviteTokenEntity)
      .where(
        and(
          eq(collabInviteTokenEntity.status, 'active' as CollabInviteStatus),
          lt(collabInviteTokenEntity.exp, now)
        )
      );
    return rows.map((row) => this._decryptRow(row));
  }

  async markConsumed(inviteId: string, consumedAt: number): Promise<void> {
    await this._db
      .update(collabInviteTokenEntity)
      .set({ status: 'consumed' as CollabInviteStatus, consumedAt })
      .where(eq(collabInviteTokenEntity.inviteId, inviteId));
    this._changed$.next({ action: 'update', inviteId });
  }

  async markRevoked(inviteId: string, revokedAt: number): Promise<void> {
    await this._db
      .update(collabInviteTokenEntity)
      .set({ status: 'revoked' as CollabInviteStatus, revokedAt })
      .where(eq(collabInviteTokenEntity.inviteId, inviteId));
    this._changed$.next({ action: 'update', inviteId });
  }

  async markExpired(inviteIds: string[]): Promise<void> {
    if (inviteIds.length === 0) {
      return;
    }
    await this._db
      .update(collabInviteTokenEntity)
      .set({ status: 'expired' as CollabInviteStatus })
      .where(inArray(collabInviteTokenEntity.inviteId, inviteIds));
    for (const id of inviteIds) {
      this._changed$.next({ action: 'update', inviteId: id });
    }
  }

  async markServerSynced(inviteId: string, syncedAt: number): Promise<void> {
    await this._db
      .update(collabInviteTokenEntity)
      .set({ serverSyncedAt: syncedAt })
      .where(eq(collabInviteTokenEntity.inviteId, inviteId));
    this._changed$.next({ action: 'update', inviteId });
  }

  async deleteByIds(inviteIds: string[]): Promise<void> {
    if (inviteIds.length === 0) {
      return;
    }
    await this._db
      .delete(collabInviteTokenEntity)
      .where(inArray(collabInviteTokenEntity.inviteId, inviteIds));
    for (const id of inviteIds) {
      this._changed$.next({ action: 'delete', inviteId: id });
    }
  }

  async countAll(): Promise<number> {
    const rows = await this._db
      .select({ count: sql<number>`count(*)` })
      .from(collabInviteTokenEntity);
    return rows[0]?.count ?? 0;
  }
}
