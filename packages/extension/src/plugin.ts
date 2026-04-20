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
import type { IExtensionConfig } from './controllers/config.schema';
import { IConfigService, Inject, Injector, merge, Plugin, registerDependencies } from '@termlnk/core';
import { IContributionPointRegistry } from './contributions/contribution-point';
import { ContributionPointRegistry } from './contributions/contribution-point-registry';
import { defaultPluginConfig, EXTENSION_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { ExtensionLifecycleService, IExtensionLifecycleService } from './lifecycle/extension-lifecycle.service';
import { ExtensionPointRegistry, IExtensionPointRegistry } from './registry/extension-point-registry';
import { IPermissionService, PermissionService } from './security/permission.service';

export const EXTENSION_PLUGIN_NAME = 'EXTENSION_PLUGIN';

export class ExtensionPlugin extends Plugin {
  static override pluginName = EXTENSION_PLUGIN_NAME;

  constructor(
    private readonly _config: Partial<IExtensionConfig> = defaultPluginConfig,
    @Inject(Injector) protected override _injector: Injector,
    @IConfigService protected readonly _configService: IConfigService
  ) {
    super();

    const config = merge(
      {},
      defaultPluginConfig,
      this._config
    );
    this._configService.setConfig(EXTENSION_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [IExtensionPointRegistry, { useClass: ExtensionPointRegistry }],
      [IContributionPointRegistry, { useClass: ContributionPointRegistry }],
      [IExtensionLifecycleService, { useClass: ExtensionLifecycleService }],
      [IPermissionService, { useClass: PermissionService }],
    ];
    registerDependencies(this._injector, dependencies);
  }
}
