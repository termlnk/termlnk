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
import { IWindowManagerService } from '../services/window-manager/window-manager.service';

export interface IWindowToggleMaximizeCommandParams {
  id: number;
}

export const WindowToggleMaximizeCommand: ICommand<IWindowToggleMaximizeCommandParams> = {
  id: 'electron-main.command.window-toggle-maximize',
  handler: async (accessor: IAccessor, params: IWindowToggleMaximizeCommandParams): Promise<boolean> => {
    const windowManagerService = accessor.get(IWindowManagerService);
    await windowManagerService.toggleMaximizeWindow(params.id);
    return true;
  },
};
