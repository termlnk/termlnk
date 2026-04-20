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
import type { IDatabaseConfig } from './controllers/config.schema';
import { IConfigService, InjectSelf, merge, mergeOverrideWithDependencies, Plugin, registerDependencies } from '@termlnk/core';
import { DEFAULT_DB_ADAPTOR } from './config/config';
import { DATABASE_PLUGIN_CONFIG_KEY, defaultPluginConfig } from './controllers/config.schema';
import { ChatRepository } from './repositories/chat';
import { ConfigRepository } from './repositories/config';
import { HostRepository } from './repositories/host';
import { McpServerRepository } from './repositories/mcp-server';
import { ProviderRepository } from './repositories/provider';
import { SkillRepository } from './repositories/skill';
import { TerminalSessionBackupRepository } from './repositories/terminal-session-backup';
import { IDBAdaptorService } from './services/db-adaptor.service';

export const DATABASE_PLUGIN_NAME = 'DATABASE_PLUGIN';

export class DatabasePlugin extends Plugin {
  static override pluginName = DATABASE_PLUGIN_NAME;

  constructor(
    private readonly _config: Partial<IDatabaseConfig> = defaultPluginConfig,
    @InjectSelf() protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
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

  private _initDependencies(): void {
    const dbAdaptor = this._config.dbAdaptor || DEFAULT_DB_ADAPTOR;

    const dependencies: Dependency[] = [
      [IDBAdaptorService, { useClass: dbAdaptor }],
      [ConfigRepository, { useClass: ConfigRepository }],
      [ChatRepository, { useClass: ChatRepository }],
      [HostRepository, { useClass: HostRepository }],
      [McpServerRepository, { useClass: McpServerRepository }],
      [ProviderRepository, { useClass: ProviderRepository }],
      [SkillRepository, { useClass: SkillRepository }],
      [TerminalSessionBackupRepository, { useClass: TerminalSessionBackupRepository }],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config.override));
  }
}
