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

import type { IAccessor, ICommand } from '@termlnk/core';
import { ILogService } from '@termlnk/core';
import { IThemeModeService } from '@termlnk/ui';

/**
 * Public automation boundary for switching theme mode. Extensions and
 * skills should call these commands; in-tree UI (Settings/Workbench) may
 * inject IThemeModeService directly and skip the command indirection.
 */

export const SetThemeModeCommand: ICommand = {
  id: 'settings-ui.command.set-theme-mode',
  handler: async (accessor: IAccessor, mode: unknown): Promise<boolean> => {
    if (mode !== 'auto' && mode !== 'dark' && mode !== 'light') {
      accessor.get(ILogService).warn('[SetThemeModeCommand]', `Invalid mode: ${String(mode)}`);
      return false;
    }
    try {
      await accessor.get(IThemeModeService).setMode(mode);
      return true;
    } catch (err) {
      accessor.get(ILogService).error('[SetThemeModeCommand]', 'Failed', err);
      return false;
    }
  },
};

export const SetDarkThemeCommand: ICommand = {
  id: 'settings-ui.command.set-dark-theme',
  handler: async (accessor: IAccessor, themeName: unknown): Promise<boolean> => {
    if (typeof themeName !== 'string' || themeName.length === 0) {
      accessor.get(ILogService).warn('[SetDarkThemeCommand]', `Invalid theme name: ${String(themeName)}`);
      return false;
    }
    try {
      await accessor.get(IThemeModeService).setDarkTheme(themeName);
      return true;
    } catch (err) {
      accessor.get(ILogService).error('[SetDarkThemeCommand]', 'Failed', err);
      return false;
    }
  },
};

export const SetLightThemeCommand: ICommand = {
  id: 'settings-ui.command.set-light-theme',
  handler: async (accessor: IAccessor, themeName: unknown): Promise<boolean> => {
    if (typeof themeName !== 'string' || themeName.length === 0) {
      accessor.get(ILogService).warn('[SetLightThemeCommand]', `Invalid theme name: ${String(themeName)}`);
      return false;
    }
    try {
      await accessor.get(IThemeModeService).setLightTheme(themeName);
      return true;
    } catch (err) {
      accessor.get(ILogService).error('[SetLightThemeCommand]', 'Failed', err);
      return false;
    }
  },
};
