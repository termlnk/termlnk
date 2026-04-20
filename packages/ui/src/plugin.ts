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
import type { IUIConfig } from './controllers/config.schema';
import { IConfigService, IContextService, Inject, Injector, merge, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { defaultPluginConfig, UI_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { LeftSidebarController } from './controllers/left-sidebar/left-sidebar.controller';
import { RightSidebarController } from './controllers/right-sidebar/right-sidebar.controller';
import { DesktopUIController } from './controllers/ui/desktop-ui.controller';
import { IUIController } from './controllers/ui/ui.controller';
import { ComponentManagerService } from './services/component/component-manager.service';
import { ContentRouterService, IContentRouterService } from './services/content-router/content-router.service';
import { DialogService, IDialogService } from './services/dialog/dialog.service';
import { DesktopLayoutService, ILayoutService } from './services/layout/layout.service';
import { IMenuManagerService, MenuManagerService } from './services/menu/menu-manager.service';
import { IUIPartsService, UIPartsService } from './services/parts/parts.service';
import { IPlatformService, PlatformService } from './services/platform/platform.service';
import { IRenderManagerService, RenderManagerService } from './services/render/render-manager.service';
import { ResizableService } from './services/resizable/resizable.service';
import { IShortcutService, ShortcutService } from './services/shortcut/shortcut.service';
import { SideTabBarService } from './services/side-tab-bar/side-tab-bar.service';
import { IStatusBarService, StatusBarService } from './services/status-bar/status-bar.service';
import { ThemeSwitcherService } from './services/theme-switcher/theme-switcher.service';

export const UI_PLUGIN_NAME = 'UI_PLUGIN';

export class UIPlugin extends Plugin {
  static override pluginName = UI_PLUGIN_NAME;

  constructor(
    private readonly _config: Partial<IUIConfig> = defaultPluginConfig,
    @IContextService private readonly _contextService: IContextService,
    @Inject(Injector) protected readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    const config = merge({}, defaultPluginConfig, this._config);
    this._configService.setConfig(UI_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting() {
    this._initDependencies();

    touchDependencies(this._injector, [
      [SideTabBarService],
      [ResizableService],
      [IContentRouterService],
      [IStatusBarService],

      [IUIController],
      [LeftSidebarController],
      [RightSidebarController],
    ]);
  }

  private _initDependencies() {
    const dependencies: Dependency[] = [
      [ComponentManagerService],
      [ThemeSwitcherService],
      [SideTabBarService],
      [ResizableService],
      [IContentRouterService, { useClass: ContentRouterService }],

      [IUIPartsService, { useClass: UIPartsService }],
      [IRenderManagerService, { useClass: RenderManagerService }],
      [ILayoutService, { useClass: DesktopLayoutService }],
      [IShortcutService, { useClass: ShortcutService }],
      [IPlatformService, { useClass: PlatformService }],
      [IMenuManagerService, { useClass: MenuManagerService }],
      [IDialogService, { useClass: DialogService, lazy: true }],
      [IStatusBarService, { useClass: StatusBarService }],

      [IUIController, {
        // eslint-disable-next-line react/no-unnecessary-use-prefix
        useFactory: (injector: Injector) => injector.createInstance(DesktopUIController, this._config),
        deps: [Injector],
      }],
      [LeftSidebarController],
      [RightSidebarController],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config.override));
  }
}
