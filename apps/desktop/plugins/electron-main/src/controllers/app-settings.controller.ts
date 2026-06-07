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

import type { IAppSettings } from '@termlnk/electron';
import type { WindowManagerService } from '../services/window-manager/window-manager.service';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { Disposable, ILifecycleService, ILogService, Inject, LifecycleStages, platform, Platform } from '@termlnk/core';
import { ConfigRepository } from '@termlnk/database';
import { ELECTRON_PLUGIN_CONFIG_KEY, IWindowManagerService, normalizeAppSettings } from '@termlnk/electron';
import { app, BrowserWindow } from 'electron';
import { filter } from 'rxjs';
import { ITrayService } from '../services/tray/tray.service';

export class AppSettingsController extends Disposable {
  private _settings: IAppSettings = normalizeAppSettings(null);

  constructor(
    @Inject(ConfigRepository) private readonly _configRepository: ConfigRepository,
    @IWindowManagerService private readonly _windowManagerService: WindowManagerService,
    @ILifecycleService private readonly _lifecycleService: ILifecycleService,
    @ILogService private readonly _logService: ILogService,
    @Inject(ITrayService) private readonly _trayService: ITrayService
  ) {
    super();

    this._init();
  }

  private _init(): void {
    void this._onReady().catch((err: any) => {
      this._logService.error(`[AppSettingsController] Failed to initialize: ${err.message}`);
    });
  }

  private async _onReady(): Promise<void> {
    await this._lifecycleService.onStage(LifecycleStages.Ready);

    const stored = await this._configRepository.getField<IAppSettings>(ELECTRON_PLUGIN_CONFIG_KEY, 'appSettings');
    this._settings = normalizeAppSettings(stored);
    this._applyTray(this._settings.trayEnabled);
    this._applyAutoLaunch(this._settings.autoLaunchEnabled);

    this._listenConfigChanges();
    this._setupCloseToTray();
  }

  private _listenConfigChanges(): void {
    this.disposeWithMe(
      this._configRepository.changed$.pipe(
        filter((event) => event.key === ELECTRON_PLUGIN_CONFIG_KEY && (event.subKey === 'appSettings' || event.subKey === undefined))
      ).subscribe(() => {
        void this._onConfigChanged();
      })
    );
  }

  private async _onConfigChanged(): Promise<void> {
    const stored = await this._configRepository.getField<IAppSettings>(ELECTRON_PLUGIN_CONFIG_KEY, 'appSettings');
    const next = normalizeAppSettings(stored);
    const prev = this._settings;
    this._settings = next;

    if (prev.trayEnabled !== next.trayEnabled) {
      this._applyTray(next.trayEnabled);
    }

    if (prev.autoLaunchEnabled !== next.autoLaunchEnabled) {
      this._applyAutoLaunch(next.autoLaunchEnabled);
    }
  }

  private _applyTray(enabled: boolean): void {
    if (enabled) {
      this._trayService.create();
    } else {
      this._trayService.destroy();
    }
  }

  private _applyAutoLaunch(enabled: boolean): void {
    if (!app.isPackaged) {
      return;
    }

    try {
      if (platform === Platform.Windows) {
        this._applyAutoLaunchWindows(enabled);
      } else if (platform === Platform.Linux) {
        this._applyAutoLaunchLinux(enabled);
      } else {
        app.setLoginItemSettings({ openAtLogin: enabled });
      }
      this._logService.log(`[AppSettingsController] Auto-launch set to ${enabled}`);
    } catch (err: any) {
      this._logService.error(`[AppSettingsController] Failed to set login item: ${err.message}`);
    }
  }

  /**
   * Windows: Squirrel.Windows installs the app under a versioned directory
   * (`app-x.y.z/`); `Update.exe` is the only stable launcher across versions.
   * Registering `process.execPath` directly would break on the next update.
   */
  private _applyAutoLaunchWindows(enabled: boolean): void {
    const updateExe = resolve(dirname(process.execPath), '..', 'Update.exe');

    if (existsSync(updateExe)) {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        path: updateExe,
        args: ['--processStart', `"${basename(process.execPath)}"`],
      });
    } else {
      app.setLoginItemSettings({ openAtLogin: enabled });
    }
  }

  /**
   * Linux: Electron's `setLoginItemSettings` does not support DEB or
   * AppImage. We follow the XDG Autostart spec and manage `.desktop` files
   * under `~/.config/autostart/`.
   */
  private _applyAutoLaunchLinux(enabled: boolean): void {
    const autostartDir = join(app.getPath('home'), '.config', 'autostart');
    const desktopFilePath = join(autostartDir, 'termlnk.desktop');

    if (enabled) {
      mkdirSync(autostartDir, { recursive: true });
      const execPath = process.env.APPIMAGE || process.execPath;
      const desktopEntry = [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Termlnk',
        `Exec=${execPath}`,
        'Terminal=false',
        'X-GNOME-Autostart-enabled=true',
        '',
      ].join('\n');
      writeFileSync(desktopFilePath, desktopEntry, 'utf-8');
    } else {
      if (existsSync(desktopFilePath)) {
        unlinkSync(desktopFilePath);
      }
    }
  }

  private _setupCloseToTray(): void {
    this.disposeWithMe(
      this._windowManagerService.setCloseInterceptor((windowId) => {
        if (this._windowManagerService.isQuitting) return false;
        if (!this._settings.closeToTray || !this._trayService.isActive) return false;

        const window = BrowserWindow.fromId(windowId);
        if (!window) return false;

        window.hide();

        if (platform === Platform.Mac) {
          app.dock?.hide();
        }

        return true;
      })
    );
  }
}
