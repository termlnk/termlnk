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

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../entities';
import type { IMcpOAuthTokenEntity, IMcpOAuthTokenEntityInsert } from '../entities';
import { Disposable, Inject } from '@termlnk/core';
import { eq } from 'drizzle-orm';
import { generateId } from '../entities/base';
import { mcpOAuthTokenEntity } from '../entities/mcp-oauth-token';
import { IDBAdaptorService } from '../services/db-adaptor.service';
import { ISecretCipherService } from '../services/secret-cipher.service';
import { decryptIfNeeded, encryptIfNeeded } from '../services/secret-cipher/credential-masker';

/**
 * MCP OAuth Token 仓库。
 *
 * 设计原则：
 * - 4 个敏感字段透明加密：accessToken / refreshToken / clientSecret / codeVerifier
 * - 非敏感字段（serverId / authorizationServerUrl / scope / expiresAt 等）保持明文，便于查询和过期判断
 * - 与 HostRepository / ProviderRepository 同模式：DI 注入 cipher，业务代码无感
 */
export class McpOAuthTokenRepository extends Disposable {
  constructor(
    @Inject(IDBAdaptorService) private readonly _dbService: IDBAdaptorService,
    @Inject(ISecretCipherService) private readonly _cipher: ISecretCipherService
  ) {
    super();
  }

  private get _db() {
    return this._dbService.db as BetterSQLite3Database<typeof schema>;
  }

  /** 解密 OAuth token 实体的全部敏感字段 */
  private _decryptEntity(entity: IMcpOAuthTokenEntity): IMcpOAuthTokenEntity {
    return {
      ...entity,
      accessToken: decryptIfNeeded(entity.accessToken, this._cipher) || null,
      refreshToken: decryptIfNeeded(entity.refreshToken, this._cipher) || null,
      clientSecret: decryptIfNeeded(entity.clientSecret, this._cipher) || null,
      codeVerifier: decryptIfNeeded(entity.codeVerifier, this._cipher) || null,
    };
  }

  /** 加密入库 payload 的全部敏感字段；幂等（已加密值跳过） */
  private _encryptPayload<T extends Partial<IMcpOAuthTokenEntityInsert>>(payload: T): T {
    const out = { ...payload };
    if (Object.hasOwn(payload, 'accessToken')) {
      out.accessToken = encryptIfNeeded(payload.accessToken, this._cipher) || null;
    }
    if (Object.hasOwn(payload, 'refreshToken')) {
      out.refreshToken = encryptIfNeeded(payload.refreshToken, this._cipher) || null;
    }
    if (Object.hasOwn(payload, 'clientSecret')) {
      out.clientSecret = encryptIfNeeded(payload.clientSecret, this._cipher) || null;
    }
    if (Object.hasOwn(payload, 'codeVerifier')) {
      out.codeVerifier = encryptIfNeeded(payload.codeVerifier, this._cipher) || null;
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
    const payload = this._encryptPayload({ ...record, id } as IMcpOAuthTokenEntityInsert);
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
