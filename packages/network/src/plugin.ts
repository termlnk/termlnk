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

import type { INetworkConfig } from './controllers/config.schema';
import { IConfigService, ILogService, Inject, Injector, LookUp, merge, mergeOverrideWithDependencies, Plugin, Quantity, registerDependencies } from '@termlnk/core';
import { defaultPluginConfig, NETWORK_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { HTTPService } from './services/http/http.service';
import { FetchHTTPImplementation } from './services/http/implementations/fetch';
import { IHTTPImplementation } from './services/http/implementations/implementation';
import { XHRHTTPImplementation } from './services/http/implementations/xhr';

export class NetworkPlugin extends Plugin {
  static override pluginName = 'NETWORK_PLUGIN';

  constructor(
    private readonly _config: Partial<INetworkConfig> = defaultPluginConfig,
    @ILogService private readonly _logger: ILogService,
    @Inject(Injector) protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    // Manage the plugin configuration.
    const { ...rest } = merge(
      {},
      defaultPluginConfig,
      this._config
    );
    this._configService.setConfig(NETWORK_PLUGIN_CONFIG_KEY, rest);
  }

  override onStarting(): void {
    const parent = this._injector.get(HTTPService, Quantity.OPTIONAL, LookUp.SKIP_SELF);
    if (parent && !this._config?.forceUseNewInstance) {
      this._logger.warn(
        '[NetworkPlugin]',
        'HTTPService is already registered in an ancestor interceptor. Skipping registration. If you want to force a new instance, set "forceUseNewInstance" to true in the plugin configuration.'
      );
      return;
    }

    const impl = this._config?.useFetchImpl
      ? FetchHTTPImplementation
      : typeof window !== 'undefined'
        ? XHRHTTPImplementation
        : FetchHTTPImplementation;

    registerDependencies(this._injector, mergeOverrideWithDependencies([
      [HTTPService],
      [IHTTPImplementation, { useClass: impl }],
    ], this._config?.override));
  }
}
