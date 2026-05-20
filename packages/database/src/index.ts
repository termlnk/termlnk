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

export { DEFAULT_DB_ADAPTOR } from './config/config';
export { DATABASE_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
export type { IDatabaseConfig } from './controllers/config.schema';
export { aiCustomModelEntity, aiProviderEntity, aiProviderModelEntity, chatMessageEntity, chatSessionEntity, collabInviteTokenEntity, configEntity, hostEntity, mcpOAuthTokenEntity, mcpServerEntity, skillEntity, syncCursorEntity, syncFieldMetaEntity, syncOutboxEntity, syncRowMetaEntity, terminalSessionBackupEntity } from './entities';
export type { IAICustomModelEntity, IAICustomModelEntityInsert, IAIProviderEntity, IAIProviderEntityInsert, IAIProviderModelEntity, IAIProviderModelEntityInsert, IChatMessageEntity, IChatMessageEntityInsert, IChatSessionEntity, IChatSessionEntityInsert, ICollabInviteTokenEntity, ICollabInviteTokenEntityInsert, IConfigEntity, IConfigEntityInsert, IHostEntity, IHostEntityInsert, IMcpOAuthTokenEntity, IMcpOAuthTokenEntityInsert, IMcpServerEntity, IMcpServerEntityInsert, ISkillEntity, ISkillEntityInsert, ISyncCursorEntity, ISyncCursorEntityInsert, ISyncFieldMetaEntity, ISyncFieldMetaEntityInsert, ISyncOutboxEntity, ISyncOutboxEntityInsert, ISyncRowMetaEntity, ISyncRowMetaEntityInsert, ITerminalSessionBackupEntity, ITerminalSessionBackupEntityInsert } from './entities';
export { runEncryptSecretsRuntimeMigration } from './migrations/runtime/encrypt-secrets.runtime';
export type { IEncryptSecretsResult } from './migrations/runtime/encrypt-secrets.runtime';
export type { IConfigChangeEvent, IConfigEntry } from './models/config';
export { DATABASE_PLUGIN_NAME, DatabasePlugin } from './plugin';
export { BackupRepository } from './repositories/backup';
export type { BackupImportMode, IBackupSnapshot } from './repositories/backup';
export { ChatRepository } from './repositories/chat';
export type { IChatSessionChangeEvent } from './repositories/chat';
export { CollabInviteTokenRepository } from './repositories/collab-invite-token';
export type { CollabInviteStatus, ICollabInviteChangeEvent } from './repositories/collab-invite-token';
export { ConfigRepository } from './repositories/config';
export { HostRepository } from './repositories/host';
export { McpOAuthTokenRepository } from './repositories/mcp-oauth-token';
export { McpServerRepository } from './repositories/mcp-server';
export { ProviderRepository } from './repositories/provider';
export type { IProviderChangeEvent } from './repositories/provider';
export { SkillRepository } from './repositories/skill';
export { SyncCursorRepository } from './repositories/sync-cursor';
export { SyncFieldMetaRepository } from './repositories/sync-field-meta';
export { SyncOutboxRepository } from './repositories/sync-outbox';
export { SyncRowMetaRepository } from './repositories/sync-row-meta';
export { TerminalSessionBackupRepository } from './repositories/terminal-session-backup';
export { IDBAdaptorService } from './services/db-adaptor.service';
export { SQLiteAdaptor } from './services/db-adaptor/sqlite.adaptor';
export type { ISQLiteDatabaseOptions } from './services/db-adaptor/sqlite.adaptor';
export { ISecretCipherService, isEncrypted, SECRET_CIPHER_PREFIX } from './services/secret-cipher.service';
export type { SecretCipherScheme } from './services/secret-cipher.service';
export { decryptCredential, decryptIfNeeded, decryptMcpConfig, decryptProxy, encryptCredential, encryptIfNeeded, encryptMcpConfig, encryptProxy } from './services/secret-cipher/credential-masker';
export { LocalDerivedSecretCipher } from './services/secret-cipher/local-derived.cipher';
