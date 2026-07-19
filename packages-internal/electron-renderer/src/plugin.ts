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
import type { IElectronRendererConfig } from './controllers/config.schema';
import { IGoogleSignInLauncher } from '@termlnk/auth';
import { DependentOn, IConfigService, Inject, Injector, IUpdaterService, merge, mergeOverrideWithDependencies, Plugin, Quantity, registerDependencies, touchDependencies } from '@termlnk/core';
import { IWindowManagerService } from '@termlnk/electron';
import { IRPCClientService, RPCClientPlugin } from '@termlnk/rpc-client';
import { ISettingsTabRegistryService } from '@termlnk/settings-ui';
import { ITerminalOutputTransportService } from '@termlnk/terminal';
import { UIPlugin } from '@termlnk/ui';
import { Cog } from 'lucide-react';
import { CompositorWarmupController } from './controllers/compositor-warmup.controller';
import { defaultPluginConfig, ELECTRON_RENDERER_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { HeaderController } from './controllers/header.controller';
import { TransparencyController } from './controllers/transparency.controller';
import { ElectronGoogleSignInLauncher } from './services/auth/google-sign-in-launcher.service';
import { RPCClientService } from './services/rpc/rpc-client.service';
import { ElectronTerminalOutputTransportService } from './services/terminal-output/terminal-output-transport.service';
import { UpdaterService } from './services/updater/updater.service';
import { WindowManagerService } from './services/window-manager/window-manager.service';
import { PlatformTab } from './views/settings/PlatformTab';

export const ELECTRON_RENDERER_PLUGIN_NAME = 'ELECTRON_RENDERER_PLUGIN';

@DependentOn(RPCClientPlugin, UIPlugin)
export class ElectronRendererPlugin extends Plugin {
  static override pluginName = ELECTRON_RENDERER_PLUGIN_NAME;

  constructor(
    private readonly _config: Partial<IElectronRendererConfig> = defaultPluginConfig,
    @Inject(Injector) protected readonly _injector: Injector,
    @IConfigService protected readonly _configService: IConfigService
  ) {
    super();

    const config = merge(
      {},
      defaultPluginConfig,
      this._config
    );
    this._configService.setConfig(ELECTRON_RENDERER_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    this._initDependencies();

    touchDependencies(this._injector, [
      [HeaderController],
      [TransparencyController],
      [CompositorWarmupController],
    ]);
  }

  override onReady(): void {
    this._registerPlatformSettingsTab();
  }

  // Desktop-only OS integration switches (system tray / OS auto-launch /
  // powerSaveBlocker keep-awake). Registered in onReady so SettingsUIPlugin's
  // ISettingsTabRegistryService binding is already present. OPTIONAL injection
  // means island secondary windows (which omit SettingsUIPlugin) silently skip.
  private _registerPlatformSettingsTab(): void {
    const registry = this._injector.get(ISettingsTabRegistryService, Quantity.OPTIONAL);
    if (!registry) {
      return;
    }
    this.disposeWithMe(
      registry.register({
        id: 'platform',
        labelKey: 'electron-renderer.platform-tab.label',
        descriptionKey: 'electron-renderer.platform-tab.description',
        icon: Cog,
        component: PlatformTab,
        order: 15,
      })
    );
  }

  private _initDependencies(): void {
    const dependencies: Dependency[] = [
      [IRPCClientService, { useClass: RPCClientService }],
      [ITerminalOutputTransportService, { useClass: ElectronTerminalOutputTransportService }],
      [IWindowManagerService, { useClass: WindowManagerService }],
      [IUpdaterService, { useClass: UpdaterService }],
      [IGoogleSignInLauncher, { useClass: ElectronGoogleSignInLauncher }],

      [HeaderController],
      [TransparencyController],
      [CompositorWarmupController],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config?.override));
  }
}
