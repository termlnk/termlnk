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
import { IPTYService } from '@termlnk/terminal';
import { ILastCwdService } from '../services/local-terminal/last-cwd.service';
import { ITerminalUIService } from '../services/terminal/terminal-ui.service';

export const OpenLocalTerminalCommand: ICommand = {
  id: 'terminal-ui.command.open-local-terminal',
  handler: async (accessor: IAccessor) => {
    const terminalUIService = accessor.get(ITerminalUIService);
    const ptyService = accessor.get(IPTYService);
    const lastCwdService = accessor.get(ILastCwdService);

    const lastCwd = await lastCwdService.getLastCwd();
    const sessionId = await ptyService.createSession({ cols: 80, rows: 24, cwd: lastCwd || undefined });
    terminalUIService.addSession({
      id: sessionId,
      type: 'local',
      hostId: '',
      hostName: 'Local',
      status: 'idle',
    });
    terminalUIService.setActiveSession(sessionId);

    return true;
  },
};
