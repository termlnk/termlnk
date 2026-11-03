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
import type { HostKeyVerifyAction, SSHSessionEvent, SSHSessionStatus } from '../models/ssh';
import type { ITerminalMiddlewareStack } from './terminal-middleware';
import { createIdentifier } from '@termlnk/core';

/** Result of a one-shot remote exec (no PTY). */
export interface ISSHExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * The session surface consumers may rely on. Deliberately narrower than the
 * concrete SSHSession: everything here is stable contract, so tRPC routers,
 * AI tools and feature services can be typed instead of taking `any`.
 */
export interface ISSHSessionHandle {
  readonly sessionId: string;
  readonly hostId: string;
  readonly label: string;
  readonly cols: number;
  readonly rows: number;
  readonly status: SSHSessionStatus;
  readonly closeReason: 'auth_failed' | 'error' | undefined;

  readonly status$: Observable<SSHSessionStatus>;
  readonly event$: Observable<SSHSessionEvent>;
  readonly data$: Observable<Uint8Array>;
  readonly error$: Observable<string>;
  readonly resize$: Observable<{ cols: number; rows: number }>;

  /** Filters installed on this session's byte stream (trzsz / zmodem). */
  readonly middlewareStack: ITerminalMiddlewareStack;

  write(data: string | Uint8Array): Promise<void>;
  resize(rows: number, cols: number): Promise<void>;
  execCommand(command: string): Promise<ISSHExecResult>;

  /** Write straight to the channel, bypassing the middleware stack. */
  rawWrite(data: Uint8Array): void;
  /** Inject bytes into `data$` as if they came from the remote. */
  pushData(data: Uint8Array): void;

  respondKeyboardInteractive(responses: string[], viaHopId?: string): void;
  respondChangePassword(newPassword: string, viaHopId?: string): void;
  respondHostKeyVerify(action: HostKeyVerifyAction): void;
}

export interface ISSHSessionService {
  createSession(hostId: string, options: { sessionId?: string; cols?: number; rows?: number; password?: string }): Promise<string>;
  closeSession(sessionId: string): Promise<void>;
  retrySession(sessionId: string, password: string): Promise<void>;
  getSession(sessionId: string): ISSHSessionHandle | undefined;
  getAllSessions(): ISSHSessionHandle[];
  /** First session multiplexed onto the given host, if any. */
  findSessionIdByHostId(hostId: string): string | undefined;
  /**
   * Run a command on the session's shared socket without touching its
   * interactive shell channel. Used by the project Git / fs panels.
   */
  execCommand(sessionId: string, command: string): Promise<ISSHExecResult>;
  write(sessionId: string, data: string | Uint8Array): Promise<void>;
  resize(sessionId: string, rows: number, cols: number): Promise<void>;
}
export const ISSHSessionService = createIdentifier<ISSHSessionService>('rpc.ssh-session-service');
