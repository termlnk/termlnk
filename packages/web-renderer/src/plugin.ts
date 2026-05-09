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
import type { IWebRendererConfig } from './controllers/config.schema';
import { DependentOn, IConfigService, Inject, InjectSelf, merge, mergeOverrideWithDependencies, Plugin, registerDependencies } from '@termlnk/core';
import { IUpdaterService, IWindowManagerService } from '@termlnk/electron';
import { IRPCClientService, RPCClientPlugin } from '@termlnk/rpc-client';
import { UIPlugin } from '@termlnk/ui';
import { defaultPluginConfig, WEB_RENDERER_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { WebRPCClientService } from './services/rpc/web-rpc-client.service';
import { NoopUpdaterService } from './services/updater/noop-updater.service';
import { NoopWindowManagerService } from './services/window-manager/noop-window-manager.service';

export const WEB_RENDERER_PLUGIN_NAME = 'WEB_RENDERER_PLUGIN';

/**
 * WebRendererPlugin — browser-side counterpart to ElectronRendererPlugin.
 *
 * Registers:
 * - `IRPCClientService` -> `WebRPCClientService` (httpBatchLink + wsLink +
 *   splitLink instead of `ipcLink`).
 * - `IWindowManagerService` / `IUpdaterService` -> no-op placeholders so
 *   downstream UI plugins (workbench title bar, settings tab) keep
 *   resolving these tokens without crashing. The web SPA hides the
 *   relevant buttons via capability flags rather than gating on DI.
 *
 * Mirror of ElectronRendererPlugin's shape — same DependentOn set
 * (RPCClientPlugin + UIPlugin), same DI tokens. Use this in the SPA's
 * `core.registerPlugin(...)` chain in place of ElectronRendererPlugin
 * (and skip UpdaterUIPlugin entirely).
 */
@DependentOn(RPCClientPlugin, UIPlugin)
export class WebRendererPlugin extends Plugin {
  static override pluginName = WEB_RENDERER_PLUGIN_NAME;

  constructor(
    private readonly _config: Partial<IWebRendererConfig> = defaultPluginConfig,
    @InjectSelf() protected readonly _injector: Injector,
    @Inject(IConfigService) private readonly _configService: IConfigService
  ) {
    super();
    const merged = merge({}, defaultPluginConfig, this._config);
    this._configService.setConfig(WEB_RENDERER_PLUGIN_CONFIG_KEY, merged);
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [IRPCClientService, { useClass: WebRPCClientService }],
      [IWindowManagerService, { useClass: NoopWindowManagerService }],
      [IUpdaterService, { useClass: NoopUpdaterService }],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config?.override));
  }
}
