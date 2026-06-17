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

import type { MenuItemConstructorOptions } from 'electron';
import type { WindowManagerService } from '../window-manager/window-manager.service';
import process from 'node:process';
import { createIdentifier, Disposable, ILogService, platform, Platform } from '@termlnk/core';
import { IWindowManagerService } from '@termlnk/electron';
import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron';
import { join } from 'pathe';

export interface ITrayService {
  readonly isActive: boolean;
  create(): void;
  destroy(): void;
}

export const ITrayService = createIdentifier<ITrayService>('electron-main.tray.service');

function getTrayIconPath(): string {
  const resourcesDir = app.isPackaged
    ? process.resourcesPath
    : join(app.getAppPath(), 'resources');
  switch (platform) {
    case Platform.Mac:
      return join(resourcesDir, 'icon-tray.png');
    case Platform.Windows:
      return join(resourcesDir, 'icon-tray.ico');
    default:
      return join(resourcesDir, 'icon.png');
  }
}

export class TrayService extends Disposable implements ITrayService {
  private _tray: Tray | null = null;

  constructor(
    @ILogService private readonly _logService: ILogService,
    @IWindowManagerService private readonly _windowManagerService: WindowManagerService
  ) {
    super();
  }

  get isActive(): boolean {
    return this._tray !== null && !this._tray.isDestroyed();
  }

  create(): void {
    if (this._tray) {
      return;
    }

    try {
      const iconPath = getTrayIconPath();
      const icon = nativeImage.createFromPath(iconPath);
      const trayIcon = platform === Platform.Mac ? icon.resize({ width: 18 }) : icon;

      this._tray = new Tray(trayIcon);
      this._tray.setToolTip(app.getName());
      this._updateContextMenu();

      if (platform === Platform.Windows) {
        this._tray.on('click', () => {
          void this._showMainWindow();
        });
      }

      this._logService.log('[TrayService] Tray created');
    } catch (err: any) {
      this._logService.error(`[TrayService] Failed to create tray: ${err.message}`);
    }
  }

  destroy(): void {
    if (this._tray) {
      this._tray.destroy();
      this._tray = null;
      this._logService.log('[TrayService] Tray destroyed');
    }
  }

  override dispose(): void {
    this.destroy();
    super.dispose();
  }

  private async _showMainWindow(): Promise<void> {
    // Filter out the island window so we only show the main application window
    const windows = BrowserWindow.getAllWindows()
      .filter((w) => !w.webContents.getURL().includes('island.html'));
    if (windows.length === 0) {
      return;
    }

    const target = windows.find((w) => !w.isMinimized()) ?? windows[0];

    // `dock.show()` runs an async `setActivationPolicy(Regular)`. We have
    // to await it so the app leaves Accessory mode before `window.show()`
    // can actually bring the window to the front.
    if (platform === Platform.Mac) {
      await app.dock?.show();
    }

    target.show();
    target.focus();
  }

  private _updateContextMenu(): void {
    if (!this._tray) {
      return;
    }

    const menuItems: MenuItemConstructorOptions[] = [
      {
        label: 'Show Termlnk',
        click: () => {
          void this._showMainWindow();
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          this._windowManagerService.markWillQuit();
          app.quit();
        },
      },
    ];

    this._tray.setContextMenu(Menu.buildFromTemplate(menuItems));
  }
}
