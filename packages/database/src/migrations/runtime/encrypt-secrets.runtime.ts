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

// Idempotent runtime migration: re-encrypt rows whose sensitive fields are still plaintext.
// Runs outside a transaction so a single bad row cannot block the rest; safe to re-run on
// every startup because the prefix probe (`isEncrypted`) skips already-encrypted values.
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

const OAUTH_SENSITIVE_FIELDS = ['accessToken', 'refreshToken', 'clientSecret', 'codeVerifier'] as const;

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

  const mcpServers = await db.select().from(mcpServerEntity);
  for (const server of mcpServers) {
    result.mcpServersScanned += 1;
    if (server.config && _mcpConfigNeedsEncryption(server.config)) {
      const encrypted = encryptMcpConfig(server.config, cipher);
      await db
        .update(mcpServerEntity)
        .set({ config: encrypted, updatedAt: new Date().toISOString() })
        .where(eq(mcpServerEntity.id, server.id));
      result.mcpServersEncrypted += 1;
    }
  }

  const tokens = await db.select().from(mcpOAuthTokenEntity);
  for (const token of tokens) {
    result.mcpOAuthTokensScanned += 1;
    const updates: Partial<Record<typeof OAUTH_SENSITIVE_FIELDS[number], string | null>> & { updatedAt?: string } = {};
    for (const field of OAUTH_SENSITIVE_FIELDS) {
      const value = token[field];
      if (value && !isEncrypted(value)) {
        updates[field] = encryptIfNeeded(value, cipher);
      }
    }
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date().toISOString();
      await db.update(mcpOAuthTokenEntity).set(updates).where(eq(mcpOAuthTokenEntity.id, token.id));
      result.mcpOAuthTokensEncrypted += 1;
    }
  }

  return result;
}

function _mcpConfigNeedsEncryption(config: McpServerConfig): boolean {
  const sensitive = config.type === 'stdio' ? config.env : config.headers;
  return Object.values(sensitive ?? {}).some((v) => v !== '' && !isEncrypted(v));
}

function _hostCredentialNeedsEncryption(credential: ICredential): boolean {
  if (credential.type === 'password') {
    return credential.password !== '' && !isEncrypted(credential.password);
  }
  if (credential.type === 'rsa') {
    return credential.privateKey !== '' && !isEncrypted(credential.privateKey);
  }
  return false;
}
