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

import type { Observable } from 'rxjs';
import type { ITerminalSessionCreatedEvent } from '../models/terminal-session';
import { createIdentifier } from '@termlnk/core';

export interface IToolSessionInfo extends ITerminalSessionCreatedEvent {
  status: string;
  isConnected: boolean;
}

export interface IToolHostInfo {
  id: string;
  label: string;
  type: string;
  addr?: string;
  port?: number;
  username?: string;
  authType?: string;
  parentId?: string;
  children?: IToolHostInfo[];
}

export interface ISSHToolService {
  listHosts(parentId?: string, flat?: boolean): Promise<IToolHostInfo[]>;
  connectHost(hostId: string, cols?: number, rows?: number): Promise<{ sessionId: string; hostId: string; hostLabel: string }>;
  closeSession(sessionId: string): Promise<void>;
  listSessions(statusFilter?: string): Promise<IToolSessionInfo[]>;
  writeToSession(sessionId: string, data: string): Promise<void>;
  getSessionData$(sessionId: string): Observable<Uint8Array | string> | null;
  getSessionStatus(sessionId: string): string | null;
}
export const ISSHToolService = createIdentifier<ISSHToolService>('rpc.ssh-tool-service');
