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
import type { ISFTPUIConfig } from './controllers/config.schema';
import { DependentOn, IConfigService, Inject, Injector, merge, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { RPCClientPlugin } from '@termlnk/rpc-client';
import { UIPlugin } from '@termlnk/ui';
import { defaultPluginConfig, SFTP_UI_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { SFTPUIController } from './controllers/sftp-ui.controller';
import { ITransferHistoryService, TransferHistoryService } from './services/transfer/transfer-history.service';

export const SFTP_UI_PLUGIN_NAME = 'SFTP_UI_PLUGIN';

@DependentOn(UIPlugin, RPCClientPlugin)
export class SFTPUIPlugin extends Plugin {
  static override pluginName = SFTP_UI_PLUGIN_NAME;

  constructor(
    private readonly _config: ISFTPUIConfig = defaultPluginConfig,
    @Inject(Injector) protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const config = merge(
      {},
      defaultPluginConfig,
      this._config
    );
    this._configService.setConfig(SFTP_UI_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    this._initDependencies();

    touchDependencies(this._injector, [
      [SFTPUIController],
    ]);
  }

  private _initDependencies(): void {
    const dependencies: Dependency[] = [
      [SFTPUIController],
      [ITransferHistoryService, { useClass: TransferHistoryService }],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config?.override));
  }
}
