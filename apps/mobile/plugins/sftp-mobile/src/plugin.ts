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
import type { ISFTPMobileConfig } from './controllers/config.schema';
import { IConfigService, InjectSelf, merge, mergeOverrideWithDependencies, Plugin, registerDependencies } from '@termlnk/core';
import { defaultPluginConfig, SFTP_MOBILE_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { IMobileSftpClientFactory, MobileSftpClientFactory } from './services/mobile-sftp-client.factory';

export const SFTP_MOBILE_PLUGIN_NAME = 'SFTP_MOBILE_PLUGIN';

export class SftpMobilePlugin extends Plugin {
  static override pluginName = SFTP_MOBILE_PLUGIN_NAME;

  // Fields are declared and assigned explicitly rather than via TS parameter
  // properties: the mobile Babel pipeline cannot combine a parameter decorator
  // with a parameter property (see apps/mobile/babel.config.js), so a decorated
  // constructor param must be a plain identifier with an explicit `this._x = x`.
  protected readonly _injector: Injector;
  private readonly _config: ISFTPMobileConfig;
  private readonly _configService: IConfigService;

  constructor(
    config: ISFTPMobileConfig = defaultPluginConfig,
    @InjectSelf() injector: Injector,
    @IConfigService configService: IConfigService
  ) {
    super();
    this._injector = injector;
    this._configService = configService;
    this._config = config;
    this._configService.setConfig(SFTP_MOBILE_PLUGIN_CONFIG_KEY, merge({}, defaultPluginConfig, config));
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [IMobileSftpClientFactory, { useClass: MobileSftpClientFactory }],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config?.override));
  }
}
