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

import type { ILocalTerminalShellOption } from '../config/config';
import type { IPTYCreateSessionOptions } from './pty.service';
import { createIdentifier } from '@termlnk/core';

export interface IPTYSessionService {
  createSession(options?: IPTYCreateSessionOptions): Promise<string>;
  closeSession(sessionId: string): Promise<void>;
  getSession(sessionId: string): any;
  getAllSessions(): any[];
  write(sessionId: string, data: string): Promise<void>;
  resize(sessionId: string, rows: number, cols: number): Promise<void>;
  getShellPath(sessionId: string): Promise<string>;
  getCurrentCwd(sessionId: string): Promise<string>;
  getLocalTerminalShellOptions(): Promise<ILocalTerminalShellOption[]>;
}
export const IPTYSessionService = createIdentifier<IPTYSessionService>('pty.pty-session-service');
