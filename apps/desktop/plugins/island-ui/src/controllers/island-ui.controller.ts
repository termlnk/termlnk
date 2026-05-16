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

import type { LocaleType } from '@termlnk/core';
import type { IIslandUIPluginConfig } from './config.schema';
import { IConfigService, ILogService, Inject, Injector, LocaleService, RxDisposable } from '@termlnk/core';
import { connectInjector } from '@termlnk/design';
import { IConfigManagerService } from '@termlnk/rpc-client';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { filter } from 'rxjs';
import { DynamicIsland } from '../views/island/DynamicIsland';
import { ISLAND_UI_PLUGIN_CONFIG_KEY } from './config.schema';

const UI_CONFIG_KEY = 'ui.config';

export class IslandUIController extends RxDisposable {
  private _root: ReturnType<typeof createRoot> | null = null;

  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService,
    @IConfigManagerService private readonly _configManagerService: IConfigManagerService
  ) {
    super();

    this._initUI();
    this._initLocale();
  }

  private _initUI(): void {
    const config = this._configService.getConfig<IIslandUIPluginConfig>(ISLAND_UI_PLUGIN_CONFIG_KEY);
    if (!config?.container) {
      this._logService.warn('[IslandUIController]', 'No container configured, skipping render');
      return;
    }

    const ConnectedIsland = connectInjector(DynamicIsland, this._injector);
    this._root = createRoot(config.container);
    this._root.render(createElement(ConnectedIsland));
    this._logService.log('[IslandUIController]', 'Dynamic Island rendered');
  }

  private _initLocale(): void {
    void this._loadPersistedLocale();

    this.disposeWithMe(
      this._configManagerService.onChanged$().pipe(
        filter((event) => event.key === UI_CONFIG_KEY && event.subKey === 'locale')
      ).subscribe(() => {
        void this._loadPersistedLocale();
      })
    );
  }

  private async _loadPersistedLocale(): Promise<void> {
    const savedLocale = await this._configManagerService.getField<string>(UI_CONFIG_KEY, 'locale');
    if (savedLocale) {
      const localeService = this._injector.get(LocaleService);
      localeService.setLocale(savedLocale as LocaleType);
    }
  }

  override dispose(): void {
    if (this._root) {
      this._root.unmount();
      this._root = null;
    }
    super.dispose();
  }
}
