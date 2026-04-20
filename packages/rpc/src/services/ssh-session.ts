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

import { createIdentifier } from '@termlnk/core';

export interface ISSHSessionService {
  createSession(hostId: string, options: { sessionId?: string; cols?: number; rows?: number; password?: string }): Promise<string>;
  closeSession(sessionId: string): Promise<void>;
  retrySession(sessionId: string, password: string): Promise<void>;
  getSession(sessionId: string): any;
  getAllSessions(): any[];
  write(sessionId: string, data: string | Uint8Array): Promise<void>;
  resize(sessionId: string, rows: number, cols: number): Promise<void>;
}
export const ISSHSessionService = createIdentifier<ISSHSessionService>('rpc.ssh-session-service');
