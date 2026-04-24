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
import { ICommandService } from '@termlnk/core';
import { HostType } from '@termlnk/terminal';
import { HostDialogMode } from '../models/host-dialog.state';
import { IHostExplorerService } from '../services/hosts-explorer/hosts-explorer.service';
import { ToggleHostDialogCommand } from './toggle-host-dialog.command';

export const NewHostCommand: ICommand = {
  id: 'terminal-ui.command.new-host',
  handler: async (accessor: IAccessor) => {
    const focused = accessor.get(IHostExplorerService).getFocusedHost();
    const commandService = accessor.get(ICommandService);

    // Derive the parent group so the new host is created in the expected
    // scope:
    //   - focused on a group  → create as a child of it
    //   - focused on a host   → create as a sibling (same parent)
    //   - nothing focused     → let the dialog default (root)
    const parentId = focused?.type === HostType.GROUP
      ? focused.id
      : focused?.pid;

    await commandService.executeCommand(ToggleHostDialogCommand.id, {
      mode: HostDialogMode.CREATE,
      parentId,
    });
    return true;
  },
};
