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

import type { McpServerConfig } from '@termlnk/agent';
import type { ICredential } from '@termlnk/terminal';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../../entities';
import type { ISecretCipherService } from '../../services/secret-cipher.service';
import { eq } from 'drizzle-orm';
import { hostEntity } from '../../entities/host';
import { mcpOAuthTokenEntity } from '../../entities/mcp-oauth-token';
import { mcpServerEntity } from '../../entities/mcp-server';
import { aiProviderEntity } from '../../entities/provider';
import { isEncrypted } from '../../services/secret-cipher.service';
import {
  encryptCredential,
  encryptIfNeeded,
  encryptMcpConfig,
  encryptProxy,
} from '../../services/secret-cipher/credential-masker';

/**
 * 运行时迁移：将已存在的明文凭据加密。
 *
 * 设计原则：
 * - **幂等**：基于密文前缀判断是否已加密，重复运行不重复加密
 * - **不在事务中**：单条记录失败不阻塞整体；但也意味着崩溃时可能部分迁移完成
 * - **同步执行**：通过 better-sqlite3 同步 API 跑，避免启动卡顿（数据量小）
 * - **不记 schema_version**：因为幂等且按行检查，每次启动重跑也只处理新明文
 *
 * 调用时机：DatabasePlugin 启动后，IDBAdaptorService.initialize() 之后。
 */
export interface IEncryptSecretsResult {
  hostsEncrypted: number;
  hostsScanned: number;
  providersEncrypted: number;
  providersScanned: number;
  mcpServersEncrypted: number;
  mcpServersScanned: number;
  mcpOAuthTokensEncrypted: number;
  mcpOAuthTokensScanned: number;
}

export async function runEncryptSecretsRuntimeMigration(
  db: BetterSQLite3Database<typeof schema>,
  cipher: ISecretCipherService
): Promise<IEncryptSecretsResult> {
  const result: IEncryptSecretsResult = {
    hostsEncrypted: 0,
    hostsScanned: 0,
    providersEncrypted: 0,
    providersScanned: 0,
    mcpServersEncrypted: 0,
    mcpServersScanned: 0,
    mcpOAuthTokensEncrypted: 0,
    mcpOAuthTokensScanned: 0,
  };

  // -- 1) 扫描 host：credential / proxy --
  const hosts = await db.select().from(hostEntity);
  for (const host of hosts) {
    result.hostsScanned += 1;
    const updates: { credential?: typeof host.credential; proxy?: typeof host.proxy; updatedAt?: string } = {};

    if (host.credential && _hostCredentialNeedsEncryption(host.credential)) {
      updates.credential = encryptCredential(host.credential, cipher);
    }

    if (host.proxy && host.proxy.password && !isEncrypted(host.proxy.password)) {
      updates.proxy = encryptProxy(host.proxy, cipher);
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date().toISOString();
      await db.update(hostEntity).set(updates).where(eq(hostEntity.id, host.id));
      result.hostsEncrypted += 1;
    }
  }

  // -- 2) 扫描 ai_provider：apiKey --
  const providers = await db.select().from(aiProviderEntity);
  for (const provider of providers) {
    result.providersScanned += 1;
    if (provider.apiKey && !isEncrypted(provider.apiKey)) {
      await db
        .update(aiProviderEntity)
        .set({
          apiKey: encryptIfNeeded(provider.apiKey, cipher),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(aiProviderEntity.id, provider.id));
      result.providersEncrypted += 1;
    }
  }

  // -- 3) 扫描 mcp_server：config.env / headers 中的密钥 --
  const mcpServers = await db.select().from(mcpServerEntity);
  for (const server of mcpServers) {
    result.mcpServersScanned += 1;
    if (server.config && _mcpConfigNeedsEncryption(server.config)) {
      const encrypted = encryptMcpConfig(server.config, cipher);
      if (encrypted) {
        await db
          .update(mcpServerEntity)
          .set({ config: encrypted, updatedAt: new Date().toISOString() })
          .where(eq(mcpServerEntity.id, server.id));
        result.mcpServersEncrypted += 1;
      }
    }
  }

  // -- 4) 扫描 mcp_oauth_token：accessToken / refreshToken / clientSecret / codeVerifier --
  const tokens = await db.select().from(mcpOAuthTokenEntity);
  for (const token of tokens) {
    result.mcpOAuthTokensScanned += 1;
    const updates: {
      accessToken?: string | null;
      refreshToken?: string | null;
      clientSecret?: string | null;
      codeVerifier?: string | null;
      updatedAt?: string;
    } = {};
    if (token.accessToken && !isEncrypted(token.accessToken)) {
      updates.accessToken = encryptIfNeeded(token.accessToken, cipher);
    }
    if (token.refreshToken && !isEncrypted(token.refreshToken)) {
      updates.refreshToken = encryptIfNeeded(token.refreshToken, cipher);
    }
    if (token.clientSecret && !isEncrypted(token.clientSecret)) {
      updates.clientSecret = encryptIfNeeded(token.clientSecret, cipher);
    }
    if (token.codeVerifier && !isEncrypted(token.codeVerifier)) {
      updates.codeVerifier = encryptIfNeeded(token.codeVerifier, cipher);
    }
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date().toISOString();
      await db.update(mcpOAuthTokenEntity).set(updates).where(eq(mcpOAuthTokenEntity.id, token.id));
      result.mcpOAuthTokensEncrypted += 1;
    }
  }

  return result;
}

/** 判断 mcp_server.config 是否还有未加密的敏感字段（env/headers 任一 value 是明文即视为需迁移） */
function _mcpConfigNeedsEncryption(config: McpServerConfig): boolean {
  const sensitive = config.type === 'stdio'
    ? config.env
    : config.headers;
  return Object.values(sensitive ?? {}).some((v) => v !== '' && !isEncrypted(v));
}

/** 判断 host.credential 是否还有未加密的敏感字段 */
function _hostCredentialNeedsEncryption(credential: ICredential): boolean {
  if (credential.type === 'password') {
    return credential.password !== '' && !isEncrypted(credential.password);
  }
  if (credential.type === 'rsa') {
    return credential.privateKey !== '' && !isEncrypted(credential.privateKey);
  }
  return false;
}
