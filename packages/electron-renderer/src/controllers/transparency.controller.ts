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

import { Disposable, Platform, platform } from '@termlnk/core';
import { IWindowManagerService } from '@termlnk/electron';
import { IConfigManagerService } from '@termlnk/rpc-client';
import { filter } from 'rxjs';

/**
 * Config key for terminal plugin settings (includes transparency).
 * Duplicated from @termlnk/terminal to avoid cross-package dependency.
 */
const TERMINAL_CONFIG_KEY = 'terminal.config';

interface IWindowTransparencyConfig {
  enabled: boolean;
  opacity: number;
}

/**
 * Manages native window transparency effects based on user config.
 *
 * On Windows: adjusts the native window opacity so desktop content can
 *   show through while keeping standard resize behavior.
 *
 * On macOS: toggles vibrancy (frosted glass) on/off.
 *   When transparency is enabled, vibrancy must be removed so that
 *   CSS transparent backgrounds show through to the desktop.
 *   When transparency is disabled, vibrancy is restored.
 */
export class TransparencyController extends Disposable {
  private _windowId: number | null = null;

  constructor(
    @IWindowManagerService private readonly _windowManagerService: IWindowManagerService,
    @IConfigManagerService private readonly _configManagerService: IConfigManagerService
  ) {
    super();

    this._init();
  }

  private _init(): void {
    if (platform !== Platform.Mac && platform !== Platform.Windows) {
      return;
    }

    // Skip island window — it manages its own transparency via
    // the BrowserWindow `transparent: true` option in DynamicIslandController.
    if (window.location.pathname.endsWith('island.html')) {
      return;
    }

    this._applyNativeTransparency();

    this.disposeWithMe(
      this._configManagerService.onChanged$().pipe(
        filter((event) => event.key === TERMINAL_CONFIG_KEY && (event.subKey === 'transparency' || event.subKey === undefined))
      ).subscribe(() => this._applyNativeTransparency())
    );
  }

  private async _applyNativeTransparency(): Promise<void> {
    try {
      const windowId = this._windowId ?? await this._windowManagerService.getCurrentWindowId();
      this._windowId = windowId;

      const config = await this._configManagerService.getField<IWindowTransparencyConfig>(TERMINAL_CONFIG_KEY, 'transparency');

      if (platform === Platform.Windows) {
        const opacity = config?.enabled && typeof config.opacity === 'number' && config.opacity < 1
          ? config.opacity
          : 1;
        await this._windowManagerService.setOpacity(windowId, opacity);
        return;
      }

      if (config?.enabled && typeof config.opacity === 'number' && config.opacity < 1) {
        await this._windowManagerService.setVibrancy(windowId, null);
      } else {
        await this._windowManagerService.setVibrancy(windowId, 'sidebar');
      }
    } catch {
      // Silently ignore errors (e.g., window not ready yet)
    }
  }
}
