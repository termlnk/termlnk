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

import type { Dependency } from '@termlnk/core';
import type { IACPCorePluginConfig } from './controllers/config.schema';
import {
  ACPPlugin,
  IACPDiscoveryService,
  IACPSessionService,
} from '@termlnk/acp';
import {
  DependentOn,
  IConfigService,
  Inject,
  Injector,
  merge,
  mergeOverrideWithDependencies,
  Plugin,
  registerDependencies,
  touchDependencies,
} from '@termlnk/core';
import { DatabasePlugin } from '@termlnk/database';
import { ACP_CORE_PLUGIN_CONFIG_KEY, defaultPluginConfig } from './controllers/config.schema';
import { ACPDiscoveryService } from './services/discovery/acp-discovery.service';
import { ACPSessionStore } from './services/persistence/acp-session-store';
import { ACPSessionService } from './services/session/acp-session.service';

export const ACP_CORE_PLUGIN_NAME = 'ACP_CORE_PLUGIN';

@DependentOn(DatabasePlugin, ACPPlugin)
export class ACPCorePlugin extends Plugin {
  static override pluginName = ACP_CORE_PLUGIN_NAME;

  constructor(
    private readonly _config: IACPCorePluginConfig = defaultPluginConfig,
    @Inject(Injector) protected override _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const config = merge({}, defaultPluginConfig, this._config);
    this._configService.setConfig(ACP_CORE_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [ACPSessionStore],
      [IACPDiscoveryService, { useClass: ACPDiscoveryService }],
      [IACPSessionService, { useClass: ACPSessionService }],
    ];
    registerDependencies(
      this._injector,
      mergeOverrideWithDependencies(dependencies, this._config.override)
    );
  }

  override onReady(): void {
    touchDependencies(this._injector, [
      [IACPDiscoveryService],
      [IACPSessionService],
    ]);
  }
}
