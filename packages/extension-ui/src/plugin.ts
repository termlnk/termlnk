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

import type { Dependency, DependencyOverride } from '@termlnk/core';
import { DependentOn, Inject, Injector, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { ExtensionPlugin, IContributionRegistry, IExtensionHostService, IExtensionService } from '@termlnk/extension';
import { RPCClientPlugin } from '@termlnk/rpc-client';
import { UIPlugin } from '@termlnk/ui';
import { ContributionRegistry } from './contributions/contribution-registry';
import { ExtensionThemeRegistry, IExtensionThemeRegistry } from './contributions/points';
import { ExtensionUIController } from './controllers/extension-ui.controller';
import { ExtensionHostService } from './services/extension-host.service';
import { ExtensionService } from './services/extension.service';
import { HookService, IHookService } from './services/hook.service';
import { IToolRegistryService, ToolRegistryService } from './services/tool-registry.service';

export const EXTENSION_UI_PLUGIN_NAME = 'EXTENSION_UI_PLUGIN';

export interface IExtensionUIConfig {
  override?: DependencyOverride;
}

@DependentOn(UIPlugin, RPCClientPlugin, ExtensionPlugin)
export class ExtensionUIPlugin extends Plugin {
  static override pluginName = EXTENSION_UI_PLUGIN_NAME;

  constructor(
    private readonly _config: IExtensionUIConfig = {},
    @Inject(Injector) protected readonly _injector: Injector
  ) {
    super();
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [IExtensionService, { useClass: ExtensionService }],
      [IExtensionHostService, { useClass: ExtensionHostService }],
      [IContributionRegistry, { useClass: ContributionRegistry }],
      [IExtensionThemeRegistry, { useClass: ExtensionThemeRegistry }],
      [IHookService, { useClass: HookService }],
      [IToolRegistryService, { useClass: ToolRegistryService }],
      [ExtensionUIController],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config?.override));

    touchDependencies(this._injector, [
      [ExtensionUIController],
    ]);
  }

  override onReady(): void {
    const extensionService = this._injector.get(IExtensionService);
    void extensionService.initialize();
  }

  override onSteady(): void {
    const extensionService = this._injector.get(IExtensionService);
    void extensionService.activateByEvent('onStartupFinished');
  }
}
