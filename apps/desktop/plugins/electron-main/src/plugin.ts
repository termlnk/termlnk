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
import type { IElectronMainConfig } from './controllers/config.schema';
import { DependentOn, IConfigService, Inject, Injector, IUpdaterService, merge, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { ElectronPlugin, IKeepAwakeService, IWindowManagerService } from '@termlnk/electron';
import { RPCServerPlugin } from '@termlnk/rpc-server';
import { AgentKeepAwakeController } from './controllers/agent-keep-awake.controller';
import { AppSettingsController } from './controllers/app-settings.controller';
import { defaultPluginConfig, ELECTRON_MAIN_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { DynamicIslandController } from './controllers/dynamic-island.controller';
import { MainController } from './controllers/main.controller';
import { MenuController } from './controllers/menu.controller';
import { RPCController } from './controllers/rpc.controller';
import { SingleInstanceController } from './controllers/single-instance.controller';
import { WindowFocusSyncController } from './controllers/window-focus-sync.controller';
import { WindowStateController } from './controllers/window-state.controller';
import { DiskFileService } from './services/file/disk-file.service';
import { KeepAwakeService } from './services/keep-awake/keep-awake.service';
import { IPlatformService, PlatformService } from './services/platform';
import { ITrayService, TrayService } from './services/tray/tray.service';
import { UpdaterService } from './services/updater/updater.service';
import { WindowManagerService } from './services/window-manager/window-manager.service';

export const ELECTRON_MAIN_PLUGIN_NAME = 'ELECTRON_MAIN_PLUGIN';

@DependentOn(RPCServerPlugin, ElectronPlugin)
export class ElectronMainPlugin extends Plugin {
  static override pluginName = ELECTRON_MAIN_PLUGIN_NAME;

  constructor(
    private readonly _config: IElectronMainConfig = defaultPluginConfig,
    @Inject(Injector) protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const config = merge(
      {},
      defaultPluginConfig,
      this._config
    );
    this._configService.setConfig(ELECTRON_MAIN_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    this._initDependencies();

    touchDependencies(this._injector, [
      [SingleInstanceController],
      [MainController],
      [MenuController],
      [RPCController],
      [AppSettingsController],
      [WindowFocusSyncController],
    ]);
  }

  override onReady() {
    touchDependencies(this._injector, [
      [WindowStateController],
      [AgentKeepAwakeController],
    ]);
  }

  // The Dynamic Island is a macOS NSPanel — showing it before the main
  // NSWindow makes the app register as an accessory: the Dock icon
  // disappears and the main window auto-hides after switching away.
  // Defer creation until Steady, after the main window has shown.
  override onSteady(): void {
    touchDependencies(this._injector, [
      [DynamicIslandController],
    ]);
  }

  private _initDependencies(): void {
    const dependencies: Dependency[] = [
      [DiskFileService, { useClass: DiskFileService }],
      [IWindowManagerService, { useClass: WindowManagerService }],
      [IPlatformService, { useClass: PlatformService }],
      [IUpdaterService, { useClass: UpdaterService }],
      [ITrayService, { useClass: TrayService }],
      [IKeepAwakeService, { useClass: KeepAwakeService }],

      [WindowStateController],
      [SingleInstanceController],
      [MainController],
      [MenuController],
      [RPCController],
      [AppSettingsController],
      [DynamicIslandController],
      [WindowFocusSyncController],
      [AgentKeepAwakeController],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config?.override));
  }
}
