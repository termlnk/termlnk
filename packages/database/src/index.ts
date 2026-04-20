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
export { aiCustomModelEntity, aiProviderEntity, aiProviderModelEntity, chatMessageEntity, chatSessionEntity, configEntity, hostEntity, mcpOAuthTokenEntity, mcpServerEntity, skillEntity, terminalSessionBackupEntity } from './entities';
export type { IAICustomModelEntity, IAICustomModelEntityInsert, IAIProviderEntity, IAIProviderEntityInsert, IAIProviderModelEntity, IAIProviderModelEntityInsert, IChatMessageEntity, IChatMessageEntityInsert, IChatSessionEntity, IChatSessionEntityInsert, IConfigEntity, IConfigEntityInsert, IHostEntity, IHostEntityInsert, IMcpOAuthTokenEntity, IMcpOAuthTokenEntityInsert, IMcpServerEntity, IMcpServerEntityInsert, ISkillEntity, ISkillEntityInsert, ITerminalSessionBackupEntity, ITerminalSessionBackupEntityInsert } from './entities';
export type { IConfigChangeEvent, IConfigEntry } from './models/config';
export { DATABASE_PLUGIN_NAME, DatabasePlugin } from './plugin';
export { ChatRepository } from './repositories/chat';
export type { IChatSessionChangeEvent } from './repositories/chat';
export { ConfigRepository } from './repositories/config';
export { HostRepository } from './repositories/host';
export { McpServerRepository } from './repositories/mcp-server';
export { ProviderRepository } from './repositories/provider';
export type { IProviderChangeEvent } from './repositories/provider';
export { SkillRepository } from './repositories/skill';
export { TerminalSessionBackupRepository } from './repositories/terminal-session-backup';
export { IDBAdaptorService } from './services/db-adaptor.service';
export { SQLiteAdaptor } from './services/db-adaptor/sqlite.adaptor';
export type { ISQLiteDatabaseOptions } from './services/db-adaptor/sqlite.adaptor';
