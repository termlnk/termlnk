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

import type { ISSHService } from '@termlnk/rpc-client';
import type { IPTYService } from '@termlnk/terminal';
import type { DropSide, WorkspaceLayoutDirection } from '../../models/workspace.model';
import type { ITerminalUIService } from '../terminal/terminal-ui.service';
import type { IWorkspaceService } from './workspace.service';

export interface ISplitSessionServices {
  ptyService: IPTYService;
  sshService: ISSHService;
  terminalUIService: ITerminalUIService;
  workspaceService: IWorkspaceService;
}

/**
 * Split a terminal session by spawning a sibling of the same kind and attaching it beside
 * the source. Local sources spawn a new PTY; SSH sources open a parallel connection to the
 * same host. Remote (multiplayer joiner) sessions don't own their PTY and can't be split.
 *
 * Shared by the split shortcuts/command (acting on the active session) and the pane header
 * split buttons (acting on a specific pane).
 */
export async function splitTerminalSession(
  services: ISplitSessionServices,
  sourceSessionId: string,
  direction: WorkspaceLayoutDirection
): Promise<void> {
  const { ptyService, sshService, terminalUIService, workspaceService } = services;

  const session = terminalUIService.getSession(sourceSessionId);
  if (!session || session.type === 'remote') {
    return;
  }

  let newSessionId: string;
  if (session.type === 'ssh') {
    newSessionId = await sshService.createSession(session.hostId);
    terminalUIService.addSession({ id: newSessionId, type: 'ssh', hostId: session.hostId, hostName: session.hostName });
  } else {
    newSessionId = await ptyService.createSession({ cols: 80, rows: 24 });
    terminalUIService.addSession({ id: newSessionId, type: 'local', hostId: '', hostName: 'Local', status: 'idle' });
  }

  const side: DropSide = direction === 'horizontal' ? 'right' : 'bottom';
  workspaceService.splitSession(sourceSessionId, newSessionId, side);
}
