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
import { IHostManagerService, ISSHService } from '@termlnk/rpc-client';
import { ITerminalUIService } from '../services/terminal/terminal-ui.service';

export interface IConnectHostCommandParams {
  hostId: string;
}

export const ConnectHostCommand: ICommand<IConnectHostCommandParams> = {
  id: 'terminal-ui.command.connect-host',
  handler: async (accessor: IAccessor, params: IConnectHostCommandParams) => {
    const { hostId } = params;

    const hostManagerService = accessor.get(IHostManagerService);
    const uiService = accessor.get(ITerminalUIService);
    const sshService = accessor.get(ISSHService);

    const host = await hostManagerService.getInfo(hostId);
    if (!host || host.type !== 'host') {
      throw new Error(`Host ${hostId} not found or is not a valid host`);
    }

    const sessionId = await sshService.createSession(hostId);
    uiService.addSession({ id: sessionId, type: 'ssh', hostId, hostName: host.label });
    uiService.setActiveSession(sessionId);

    return true;
  },
};
