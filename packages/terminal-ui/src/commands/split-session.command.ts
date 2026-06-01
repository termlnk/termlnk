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
import type { WorkspaceLayoutDirection } from '../models/workspace.model';
import { ILogService } from '@termlnk/core';
import { ISSHService } from '@termlnk/rpc-client';
import { IPTYService } from '@termlnk/terminal';
import { ITerminalUIService } from '../services/terminal/terminal-ui.service';
import { splitTerminalSession } from '../services/workspace/split-session';
import { IWorkspaceService } from '../services/workspace/workspace.service';

export interface ISplitSessionCommandParams {
  /** `horizontal` opens the new pane to the right, `vertical` below the active one. */
  direction: WorkspaceLayoutDirection;
}

export const SplitSessionCommand: ICommand<ISplitSessionCommandParams> = {
  id: 'terminal-ui.command.split-session',
  handler: async (accessor: IAccessor, params?: ISplitSessionCommandParams) => {
    const terminalUIService = accessor.get(ITerminalUIService);
    const activeSessionId = terminalUIService.getActiveSessionId();
    if (!activeSessionId) {
      return false;
    }

    try {
      await splitTerminalSession(
        {
          ptyService: accessor.get(IPTYService),
          sshService: accessor.get(ISSHService),
          terminalUIService,
          workspaceService: accessor.get(IWorkspaceService),
        },
        activeSessionId,
        params?.direction ?? 'horizontal'
      );
      return true;
    } catch (err) {
      accessor.get(ILogService).error('[SplitSessionCommand]', 'Failed to split session:', err);
      return false;
    }
  },
};
