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

import type { DependencyOverride } from '@termlnk/core';
import type { IMainWindowState } from '../services/window-state/type';

export const ELECTRON_MAIN_PLUGIN_CONFIG_KEY = 'electron-main.config';

export const configSymbol = Symbol(ELECTRON_MAIN_PLUGIN_CONFIG_KEY);

export interface IElectronMainConfig {
  override?: DependencyOverride;

  /**
   * MainBrowserWindow load resource
   */
  url?: string;

  /**
   * electron window preload script path
   */
  preload?: string;

  /**
   * Persisted main window bounds + maximized/fullscreen flags.
   * Written via ConfigRepository; restored on startup by MainController.
   */
  mainWindowState?: IMainWindowState;
}

export const defaultPluginConfig: IElectronMainConfig = {};
