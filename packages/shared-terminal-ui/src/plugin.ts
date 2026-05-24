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
import type { ISharedTerminalUIPluginConfig } from './controllers/config.schema';
import { DependentOn, IConfigService, InjectSelf, merge, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { SharedTerminalPlugin } from '@termlnk/shared-terminal';
import { TerminalUIPlugin } from '@termlnk/terminal-ui';
import { defaultPluginConfig, SHARED_TERMINAL_UI_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { MultiplayerMountController } from './controllers/multiplayer-mount.controller';
import { RemoteSessionBridgeController } from './controllers/remote-session-bridge.controller';
import { SharedSessionTitleSyncController } from './controllers/shared-session-title-sync.controller';

export const SHARED_TERMINAL_UI_PLUGIN_NAME = 'SHARED_TERMINAL_UI_PLUGIN';

@DependentOn(SharedTerminalPlugin, TerminalUIPlugin)
export class SharedTerminalUIPlugin extends Plugin {
  static override pluginName = SHARED_TERMINAL_UI_PLUGIN_NAME;

  constructor(
    private readonly _config: ISharedTerminalUIPluginConfig = defaultPluginConfig,
    @InjectSelf() protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const config = merge(
      {},
      defaultPluginConfig,
      this._config
    );
    this._configService.setConfig(SHARED_TERMINAL_UI_PLUGIN_CONFIG_KEY, config);
  }

  override onReady(): void {
    const deps: Dependency[] = [
      [MultiplayerMountController],
      [RemoteSessionBridgeController],
      [SharedSessionTitleSyncController],
    ];
    registerDependencies(this._injector, deps);

    touchDependencies(this._injector, [
      [MultiplayerMountController],
      [RemoteSessionBridgeController],
      [SharedSessionTitleSyncController],
    ]);
  }
}
