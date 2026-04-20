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

import type { Dependency, LocaleType } from '@termlnk/core';
import type { IUIConfig } from '@termlnk/ui';
import type { ISettingsUIConfig } from './controllers/config.schema';
import { DependentOn, IConfigService, Inject, Injector, IThemeService, LocaleService, merge, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { IConfigManagerService, RPCClientPlugin } from '@termlnk/rpc-client';
import { THEME_MAP } from '@termlnk/themes';
import { DEFAULT_UI_FONT_SIZE, injectUIFontToDOM, UI_PLUGIN_CONFIG_KEY, UIPlugin } from '@termlnk/ui';
import { defaultPluginConfig, SETTINGS_UI_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { SettingsController } from './controllers/settings/settings.controller';
import { SettingsService } from './services/settings/settings.service';

export const SETTINGS_UI_PLUGIN_NAME = 'SETTINGS_UI_PLUGIN';

@DependentOn(UIPlugin, RPCClientPlugin)
export class SettingsUIPlugin extends Plugin {
  static override pluginName = SETTINGS_UI_PLUGIN_NAME;

  constructor(
    private readonly _config: Partial<ISettingsUIConfig> = defaultPluginConfig,
    @Inject(Injector) protected readonly _injector: Injector,
    @IConfigService protected readonly _configService: IConfigService
  ) {
    super();

    const config = merge(
      {},
      defaultPluginConfig,
      this._config
    );
    this._configService.setConfig(SETTINGS_UI_PLUGIN_CONFIG_KEY, config);
  }

  override onStarting(): void {
    this._initDependencies();

    touchDependencies(this._injector, [
      [SettingsController],
    ]);
  }

  override onReady(): void {
    this._loadPersistedTheme();
    this._loadPersistedLocale();
    this._loadPersistedUIFont();
  }

  private _initDependencies(): void {
    const dependencies: Dependency[] = [
      [SettingsService, { useClass: SettingsService }],
      [SettingsController],
    ];
    registerDependencies(this._injector, dependencies);
  }

  private async _loadPersistedTheme(): Promise<void> {
    try {
      const configManager = this._injector.get(IConfigManagerService);
      const savedThemeName = await configManager.getField<string>(UI_PLUGIN_CONFIG_KEY, 'theme');
      if (savedThemeName) {
        const theme = THEME_MAP.get(savedThemeName);
        if (theme) {
          const themeService = this._injector.get(IThemeService);
          themeService.setTheme(theme);
        }
      }
    } catch {
      // ignore - use default theme
    }
  }

  private async _loadPersistedLocale(): Promise<void> {
    try {
      const configManager = this._injector.get(IConfigManagerService);
      const savedLocale = await configManager.getField<string>(UI_PLUGIN_CONFIG_KEY, 'locale');
      if (savedLocale) {
        const localeService = this._injector.get(LocaleService);
        localeService.setLocale(savedLocale as LocaleType);
      }
    } catch {
      // ignore - use default locale
    }
  }

  private async _loadPersistedUIFont(): Promise<void> {
    try {
      const configManager = this._injector.get(IConfigManagerService);
      const saved = await configManager.get<IUIConfig>(UI_PLUGIN_CONFIG_KEY);
      injectUIFontToDOM(saved?.fontFamily ?? '', saved?.fontSize ?? DEFAULT_UI_FONT_SIZE);
    } catch {
      // ignore - defaults already applied by UIPlugin
    }
  }
}
