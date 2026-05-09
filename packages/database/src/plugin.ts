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

import type { Dependency, Injector } from '@termlnk/core';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { IDatabaseConfig } from './controllers/config.schema';
import type * as entities from './entities';
import { IConfigService, ILogService, InjectSelf, merge, mergeOverrideWithDependencies, Plugin, registerDependencies } from '@termlnk/core';
import { DEFAULT_DB_ADAPTOR } from './config/config';
import { DATABASE_PLUGIN_CONFIG_KEY, defaultPluginConfig } from './controllers/config.schema';
import { runEncryptSecretsRuntimeMigration } from './migrations/runtime/encrypt-secrets.runtime';
import { BackupRepository } from './repositories/backup';
import { ChatRepository } from './repositories/chat';
import { ConfigRepository } from './repositories/config';
import { HostRepository } from './repositories/host';
import { McpOAuthTokenRepository } from './repositories/mcp-oauth-token';
import { McpServerRepository } from './repositories/mcp-server';
import { ProviderRepository } from './repositories/provider';
import { SkillRepository } from './repositories/skill';
import { SyncCursorRepository } from './repositories/sync-cursor';
import { SyncFieldMetaRepository } from './repositories/sync-field-meta';
import { SyncOutboxRepository } from './repositories/sync-outbox';
import { SyncRowMetaRepository } from './repositories/sync-row-meta';
import { TerminalSessionBackupRepository } from './repositories/terminal-session-backup';
import { IDBAdaptorService } from './services/db-adaptor.service';
import { ISecretCipherService } from './services/secret-cipher.service';
import { LocalDerivedSecretCipher } from './services/secret-cipher/local-derived.cipher';

export const DATABASE_PLUGIN_NAME = 'DATABASE_PLUGIN';

export class DatabasePlugin extends Plugin {
  static override pluginName = DATABASE_PLUGIN_NAME;

  constructor(
    private readonly _config: Partial<IDatabaseConfig> = defaultPluginConfig,
    @InjectSelf() protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    if (!this._config.migrationsFolder) {
      throw new Error('migrationsFolder is required');
    }

    const config = merge(
      {},
      defaultPluginConfig,
      this._config
    );
    this._configService.setConfig(DATABASE_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    this._initDependencies();
  }

  override onReady(): void {
    // Fire-and-forget: a migration failure must not block startup. Repositories already
    // tolerate plaintext rows on read, so the next launch will retry.
    void this._runEncryptSecretsMigration();
  }

  private _initDependencies(): void {
    const dbAdaptor = this._config.dbAdaptor || DEFAULT_DB_ADAPTOR;

    const dependencies: Dependency[] = [
      [IDBAdaptorService, { useClass: dbAdaptor }],
      // Default to the cross-platform fallback; apps/desktop/main overrides this with
      // SafeStorageCipher via plugin config.
      [ISecretCipherService, { useClass: LocalDerivedSecretCipher }],
      [BackupRepository, { useClass: BackupRepository }],
      [ConfigRepository, { useClass: ConfigRepository }],
      [ChatRepository, { useClass: ChatRepository }],
      [HostRepository, { useClass: HostRepository }],
      [McpServerRepository, { useClass: McpServerRepository }],
      [McpOAuthTokenRepository, { useClass: McpOAuthTokenRepository }],
      [ProviderRepository, { useClass: ProviderRepository }],
      [SkillRepository, { useClass: SkillRepository }],
      [SyncCursorRepository, { useClass: SyncCursorRepository }],
      [SyncFieldMetaRepository, { useClass: SyncFieldMetaRepository }],
      [SyncOutboxRepository, { useClass: SyncOutboxRepository }],
      [SyncRowMetaRepository, { useClass: SyncRowMetaRepository }],
      [TerminalSessionBackupRepository, { useClass: TerminalSessionBackupRepository }],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config.override));
  }

  // Idempotent: re-runs are safe because the prefix probe skips already-encrypted rows.
  private async _runEncryptSecretsMigration(): Promise<void> {
    try {
      const dbService = this._injector.get(IDBAdaptorService);
      const cipher = this._injector.get(ISecretCipherService);
      const db = dbService.db as BetterSQLite3Database<typeof entities>;
      const result = await runEncryptSecretsRuntimeMigration(db, cipher);
      const totalEncrypted = result.hostsEncrypted + result.providersEncrypted + result.mcpServersEncrypted + result.mcpOAuthTokensEncrypted;
      if (totalEncrypted > 0) {
        this._logService.log(
          `[DatabasePlugin] Encrypted plaintext secrets (cipher: ${cipher.scheme}) — `
          + `hosts ${result.hostsEncrypted}/${result.hostsScanned}, `
          + `providers ${result.providersEncrypted}/${result.providersScanned}, `
          + `mcp-servers ${result.mcpServersEncrypted}/${result.mcpServersScanned}, `
          + `mcp-oauth-tokens ${result.mcpOAuthTokensEncrypted}/${result.mcpOAuthTokensScanned}`
        );
      }
    } catch (error) {
      this._logService.error('[DatabasePlugin] Secret encryption migration failed:', error);
    }
  }
}
