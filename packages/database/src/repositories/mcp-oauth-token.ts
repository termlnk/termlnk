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

import type { IMcpOAuthTokenEntity, IMcpOAuthTokenEntityInsert } from '../entities';
import { Disposable } from '@termlnk/core';
import { eq } from 'drizzle-orm';
import { generateId } from '../entities/base';
import { mcpOAuthTokenEntity } from '../entities/mcp-oauth-token';
import { IDBAdaptorService } from '../services/db-adaptor.service';
import { ISecretCipherService } from '../services/secret-cipher.service';
import { decryptIfNeeded, encryptIfNeeded } from '../services/secret-cipher/credential-masker';

const SENSITIVE_FIELDS = ['accessToken', 'refreshToken', 'clientSecret', 'codeVerifier'] as const;
type SensitiveField = typeof SENSITIVE_FIELDS[number];

export class McpOAuthTokenRepository extends Disposable {
  constructor(
    @IDBAdaptorService private readonly _dbService: IDBAdaptorService,
    @ISecretCipherService private readonly _cipher: ISecretCipherService
  ) {
    super();
  }

  private get _db() {
    return this._dbService.db;
  }

  private _decryptEntity(entity: IMcpOAuthTokenEntity): IMcpOAuthTokenEntity {
    const out = { ...entity };
    for (const field of SENSITIVE_FIELDS) {
      out[field] = decryptIfNeeded(entity[field], this._cipher);
    }
    return out;
  }

  private _encryptPayload<T extends Partial<IMcpOAuthTokenEntityInsert>>(payload: T): T {
    const out = { ...payload };
    for (const field of SENSITIVE_FIELDS) {
      if (Object.hasOwn(payload, field)) {
        out[field] = encryptIfNeeded(payload[field as SensitiveField], this._cipher);
      }
    }
    return out;
  }

  async getById(id: string): Promise<IMcpOAuthTokenEntity | undefined> {
    const rows = await this._db
      .select()
      .from(mcpOAuthTokenEntity)
      .where(eq(mcpOAuthTokenEntity.id, id))
      .limit(1);
    return rows[0] ? this._decryptEntity(rows[0]) : undefined;
  }

  async getByServerId(serverId: string): Promise<IMcpOAuthTokenEntity | undefined> {
    const rows = await this._db
      .select()
      .from(mcpOAuthTokenEntity)
      .where(eq(mcpOAuthTokenEntity.serverId, serverId))
      .limit(1);
    return rows[0] ? this._decryptEntity(rows[0]) : undefined;
  }

  async upsert(record: Omit<IMcpOAuthTokenEntityInsert, 'id'> & { id?: string }): Promise<string> {
    const id = record.id || generateId();
    const payload = this._encryptPayload({ ...record, id });
    await this._db
      .insert(mcpOAuthTokenEntity)
      .values(payload)
      .onConflictDoUpdate({
        target: mcpOAuthTokenEntity.id,
        set: { ...payload, updatedAt: new Date().toISOString() },
      });
    return id;
  }

  async update(id: string, updates: Partial<Omit<IMcpOAuthTokenEntityInsert, 'id'>>): Promise<void> {
    const payload = this._encryptPayload(updates);
    await this._db
      .update(mcpOAuthTokenEntity)
      .set({ ...payload, updatedAt: new Date().toISOString() })
      .where(eq(mcpOAuthTokenEntity.id, id));
  }

  async deleteByServerId(serverId: string): Promise<void> {
    await this._db.delete(mcpOAuthTokenEntity).where(eq(mcpOAuthTokenEntity.serverId, serverId));
  }
}
