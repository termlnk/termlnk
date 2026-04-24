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
import { IHostManagerService } from '@termlnk/rpc-client';
import { IHostExplorerService } from '../services/hosts-explorer/hosts-explorer.service';

export const DeleteHostCommand: ICommand = {
  id: 'terminal-ui.command.delete-host',
  handler: async (accessor: IAccessor) => {
    const focused = accessor.get(IHostExplorerService).getFocusedHost();
    if (!focused) {
      return false;
    }

    await accessor.get(IHostManagerService).delete(focused.id);
    return true;
  },
};
