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
import { IWorkspaceService } from '../services/workspace/workspace.service';

export const TogglePinWorkspaceCommand: ICommand = {
  id: 'terminal-ui.command.toggle-pin-workspace',
  handler: (accessor: IAccessor) => {
    const workspaceService = accessor.get(IWorkspaceService);
    const targetId = workspaceService.getMenuTarget();
    // The menu target is transient: consume it so a later command run (e.g. via
    // the command palette) cannot replay against a stale workspace.
    workspaceService.setMenuTarget(null);
    if (!targetId) {
      return false;
    }

    workspaceService.setWorkspacePinned(targetId, !workspaceService.isTabItemPinned(targetId));
    return true;
  },
};
