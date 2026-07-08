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
import process from 'node:process';
import { Disposable } from '@termlnk/core';
import { app, Menu } from 'electron';

const APPLICATION_NAME = 'Termlnk';

export class MenuController extends Disposable {
  constructor(
  ) {
    super();

    this._init();
  }

  private _init(): void {
    this._setupApplicationMenu();
  }

  /**
   * Set a custom application menu to prevent the default macOS menu from
   * intercepting Cmd+W (Close Window). The renderer-side shortcut system
   * handles Cmd+W to close the active terminal tab instead.
   */
  private _setupApplicationMenu(): void {
    if (process.platform !== 'darwin') {
      // On Windows/Linux autoHideMenuBar is true and the default menu
      // does not bind Ctrl+W to Close Window, so no override is needed.
      return;
    }

    app.setName(APPLICATION_NAME);

    const template: MenuItemConstructorOptions[] = [
      {
        label: APPLICATION_NAME,
        submenu: [
          { label: `About ${APPLICATION_NAME}`, role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { label: `Quit ${APPLICATION_NAME}`, role: 'quit' },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          // No 'close' role — Cmd+W is handled by the renderer shortcut system
        ],
      },
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }
}
