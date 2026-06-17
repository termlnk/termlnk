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

import type { ICreateWindowOptions } from '@termlnk/electron';
import type { IMainWindowState } from '../services/window-state/type';
import type { IElectronMainConfig } from './config.schema';
import { Disposable, IConfigService, ILifecycleService, ILogService, Inject, LifecycleStages } from '@termlnk/core';
import { IWindowManagerService, WindowEvent } from '@termlnk/electron';
import { app } from 'electron';
import { take } from 'rxjs';
import { ELECTRON_MAIN_PLUGIN_CONFIG_KEY } from './config.schema';
import { WindowStateController } from './window-state.controller';

export class MainController extends Disposable {
  protected _steadyTimeout: ReturnType<typeof setTimeout>;

  constructor(
    @IConfigService private readonly _configService: IConfigService,
    @IWindowManagerService private readonly _windowManagerService: IWindowManagerService,
    @ILifecycleService private readonly _lifecycleService: ILifecycleService,
    @ILogService private readonly _logService: ILogService,
    @Inject(WindowStateController) private readonly _windowStateController: WindowStateController
  ) {
    super();

    this._init();
  }

  override dispose(): void {
    super.dispose();
    clearTimeout(this._steadyTimeout);
  }

  private _init(): void {
    void this._startup().catch((error: any) => {
      this._logService.error(`[MainController] Failed to startup: ${error.message}`);
      app.exit(1);
    });
  }

  private async _startup(): Promise<void> {
    await app.whenReady();
    await this._lifecycleService.onStage(LifecycleStages.Ready);

    const persistedState = await this._windowStateController.getPersistedState();
    const windowId = await this._createMainWindow(persistedState);
    this._windowStateController.trackMainWindow(windowId);

    this._lifecycleService.setStage(LifecycleStages.Rendered);

    this.disposeWithMe(
      this._windowManagerService.onWindowEvent$(windowId, WindowEvent.Show)
        .pipe(take(1))
        .subscribe(() => {
          this._lifecycleService.setStage(LifecycleStages.Steady);
        })
    );

    await this._applyPersistedMode(windowId, persistedState);
    await this._windowManagerService.showWindow(windowId);
  }

  private async _createMainWindow(persistedState: IMainWindowState): Promise<number> {
    const config = this._configService.getConfig<IElectronMainConfig>(ELECTRON_MAIN_PLUGIN_CONFIG_KEY);
    if (!config?.url) {
      throw new Error('url is required');
    }

    const options: ICreateWindowOptions = {
      ...persistedState.bounds,
      hiddenInMissionControl: true,
      webPreferences: {
        preload: config.preload,
        devTools: true,
      },
    };
    return this._windowManagerService.createWindow(config.url, options);
  }

  private async _applyPersistedMode(windowId: number, persistedState: IMainWindowState): Promise<void> {
    if (persistedState.isFullScreen) {
      await this._windowManagerService.toggleFullScreen(windowId);
      return;
    }
    if (persistedState.isMaximized) {
      await this._windowManagerService.maximizeWindow(windowId);
    }
  }
}
