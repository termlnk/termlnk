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
import { IAIAgentMessagingService } from '@termlnk/rpc-client';
import { ITerminalUIService } from '../services/terminal/terminal-ui.service';

/**
 * Apply the most recent error-fix suggestion to the active terminal session.
 * The command is written to PTY (Ctrl+U + command, with \n for safe ones,
 * without for dangerous). No-op when no suggestion is queued.
 */
export const ApplyErrorFixCommand: ICommand = {
  id: 'terminal-ui.command.apply-error-fix',
  handler: (accessor: IAccessor) => {
    const terminalUIService = accessor.get(ITerminalUIService);
    const aiAgentService = accessor.get(IAIAgentMessagingService);
    const sessionId = terminalUIService.getActiveSessionId();
    if (!sessionId) {
      return false;
    }
    void aiAgentService.applyTerminalErrorFix(sessionId).catch(() => {
      // Best-effort apply; nothing to surface from a fire-and-forget shortcut.
    });
    return true;
  },
};
