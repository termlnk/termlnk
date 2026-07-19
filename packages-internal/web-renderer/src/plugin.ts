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
import { IGoogleSignInLauncher } from '@termlnk/auth';
import { DependentOn, IConfigService, Inject, InjectSelf, IUpdaterService, merge, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { IWindowManagerService } from '@termlnk/electron';
import { IRPCClientService, RPCClientPlugin } from '@termlnk/rpc-client';
import { IBrowserFileTransferService } from '@termlnk/sftp-ui';
import { ITerminalOutputTransportService } from '@termlnk/terminal';
import { IHostEnvironmentService, UIPlugin, WebHostEnvironmentService } from '@termlnk/ui';
import { defaultPluginConfig, WEB_RENDERER_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { WebHeaderController } from './controllers/header.controller';
import { WebDeepLinkController } from './controllers/web-deep-link.controller';
import { WebGoogleSignInLauncher } from './services/auth/google-sign-in-launcher.service';
import { WebRPCClientService } from './services/rpc/web-rpc-client.service';
import { BrowserFileTransferService } from './services/sftp/browser-file-transfer.service';
import { WebTerminalOutputTransportService } from './services/terminal-output/terminal-output-transport.service';
import { WebUpdaterService } from './services/updater/web-updater.service';
import { NoopWindowManagerService } from './services/window-manager/noop-window-manager.service';

export const WEB_RENDERER_PLUGIN_NAME = 'WEB_RENDERER_PLUGIN';

@DependentOn(RPCClientPlugin, UIPlugin)
export class WebRendererPlugin extends Plugin {
  static override pluginName = WEB_RENDERER_PLUGIN_NAME;

  constructor(
    private readonly _config: Partial<IWebRendererConfig> = defaultPluginConfig,
    @InjectSelf() protected readonly _injector: Injector,
    @Inject(IConfigService) private readonly _configService: IConfigService
  ) {
    super();

    const config = merge(
      {},
      defaultPluginConfig,
      this._config
    );
    this._configService.setConfig(WEB_RENDERER_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [IRPCClientService, { useClass: WebRPCClientService }],
      [ITerminalOutputTransportService, { useClass: WebTerminalOutputTransportService }],
      [IWindowManagerService, { useClass: NoopWindowManagerService }],
      [IUpdaterService, { useClass: WebUpdaterService }],
      [IBrowserFileTransferService, { useClass: BrowserFileTransferService }],
      [IHostEnvironmentService, { useClass: WebHostEnvironmentService }],
      [IGoogleSignInLauncher, { useClass: WebGoogleSignInLauncher }],
      [WebHeaderController],
      [WebDeepLinkController],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config?.override));
  }

  override onReady(): void {
    touchDependencies(this._injector, [
      [WebHeaderController],
      // Reads window.location once the app is up — OAuth callback / invite intake.
      [WebDeepLinkController],
    ]);
  }
}
