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
import { DependentOn, IConfigService, Inject, InjectSelf, IUpdaterService, merge, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { IWindowManagerService } from '@termlnk/electron';
import { IRPCClientService, RPCClientPlugin } from '@termlnk/rpc-client';
import { IBrowserFileTransferService } from '@termlnk/sftp-ui';
import { IHostEnvironmentService, UIPlugin, WebHostEnvironmentService } from '@termlnk/ui';
import { defaultPluginConfig, WEB_RENDERER_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { WebHeaderController } from './controllers/header.controller';
import { WebRPCClientService } from './services/rpc/web-rpc-client.service';
import { BrowserFileTransferService } from './services/sftp/browser-file-transfer.service';
import { WebUpdaterService } from './services/updater/web-updater.service';
import { NoopWindowManagerService } from './services/window-manager/noop-window-manager.service';

export const WEB_RENDERER_PLUGIN_NAME = 'WEB_RENDERER_PLUGIN';

/**
 * WebRendererPlugin — browser-side counterpart to ElectronRendererPlugin.
 *
 * Registers:
 * - `IRPCClientService` -> `WebRPCClientService` (httpBatchLink + wsLink +
 *   splitLink instead of `ipcLink`).
 * - `IWindowManagerService` -> no-op placeholder so downstream UI plugins
 *   (workbench title bar, settings tab) keep resolving the token without
 *   crashing. The SPA hides irrelevant buttons via capability flags.
 * - `IUpdaterService` -> WebUpdaterService, polling GitHub Releases on a
 *   24h cadence to surface a "new version available" hint. Download /
 *   install reject with NOT_SUPPORTED — operators update by pulling a
 *   new docker image or running git pull, which UpdateDialog explains.
 *
 * Mirror of ElectronRendererPlugin's shape — same DependentOn set
 * (RPCClientPlugin + UIPlugin), same DI tokens. Use this in the SPA's
 * `core.registerPlugin(...)` chain in place of ElectronRendererPlugin;
 * UIPlugin's built-in UpdaterUIController picks up the IUpdaterService
 * binding and renders the update button + dialog with the shared UI.
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
      [IUpdaterService, { useClass: WebUpdaterService }],
      // SFTP UI looks up IBrowserFileTransferService via Quantity.OPTIONAL —
      // its presence is the signal to switch into single-pane (web) mode and
      // surface the upload / download buttons that work against the user's
      // browser instead of the local filesystem.
      [IBrowserFileTransferService, { useClass: BrowserFileTransferService }],
      // Settings UI / extension UI consult IHostEnvironmentService to decide
      // whether to render Electron-only controls (system tray, OS auto-launch,
      // power management). Quantity.OPTIONAL on the consumer side defaults to
      // electron when this binding is absent — desktop never registers.
      [IHostEnvironmentService, { useClass: WebHostEnvironmentService }],
      // WebHeaderController registers WebHeader into BuiltInUIPart.HEADER —
      // the browser counterpart to ElectronRendererPlugin's HeaderController.
      // Without this, BuiltInUIPart.HEADER stays empty and the workbench
      // renders without a top bar.
      [WebHeaderController],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config?.override));
  }

  override onReady(): void {
    // Touch the header controller so its constructor runs and registers the
    // component into IUIPartsService before the workbench paints. Mirrors
    // the way RPCClientPlugin / UIPlugin trigger their controllers.
    touchDependencies(this._injector, [
      [WebHeaderController],
    ]);
  }
}
