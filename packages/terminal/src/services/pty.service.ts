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
import type { ILocalTerminalShellOption } from '../config/config';
import type { PTYSessionStatus } from '../models/pty';
import { createIdentifier } from '@termlnk/core';

export interface IPTYCreateSessionOptions {
  /** Reuse a specific session ID (for persistence restore). If omitted, a new UUID is generated. */
  sessionId?: string;
  cols?: number;
  rows?: number;
  cwd?: string;
  shell?: string;
  /**
   * Mark this session as restored from persistence. On Windows, enables
   * ConPTY's PSEUDOCONSOLE_INHERIT_CURSOR so the initial startup does not
   * clear the screen and wipe the pre-written scrollback buffer.
   */
  restored?: boolean;
}

export interface IPTYService {
  createSession(options?: IPTYCreateSessionOptions): Promise<string>;
  closeSession(sessionId: string): Promise<void>;
  resize(sessionId: string, rows: number, cols: number): Promise<void>;
  write(sessionId: string, data: string): Promise<void>;
  data$(sessionId: string): Observable<string>;
  status$(sessionId: string): Observable<PTYSessionStatus>;
  getShellPath(sessionId: string): Promise<string>;
  getCurrentCwd(sessionId: string): Promise<string>;
  getLocalTerminalShellOptions(): Promise<ILocalTerminalShellOption[]>;
}

export const IPTYService = createIdentifier<IPTYService>('pty.pty-service');
