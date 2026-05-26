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
import type { RemoteSessionEvent, RemoteSessionStatus } from '../models/remote-session';
import { createIdentifier } from '@termlnk/core';

export interface IRemoteSessionCreateOptions {
  readonly inviteUrl: string;
}

export interface IRemoteSessionCreatedEvent {
  readonly sessionId: string;
  readonly connectionId: string;
}

export interface IRemoteSessionClosedEventNotify {
  readonly sessionId: string;
}

export interface IRemoteSessionCreateResult {
  readonly sessionId: string;
  readonly connectionId: string;
}

/**
 * Joiner-side single session contract, the structural twin of SSHSession /
 * PTYSession. Data flows in `data$` as raw PTY bytes; structured high-level
 * notifications flow in `event$`. Frames + crypto are encapsulated below the
 * session boundary and never reach this surface.
 */
export interface IRemoteSession {
  readonly sessionId: string;
  readonly cols: number;
  readonly rows: number;
  readonly status$: Observable<RemoteSessionStatus>;
  readonly data$: Observable<Uint8Array>;
  readonly event$: Observable<RemoteSessionEvent>;
  /**
   * Latest error string, or null when the session is healthy. Auto-cleared on
   * a successful reconnect so the UI's red badge does not get stuck after a
   * transient failure.
   */
  readonly error$: Observable<string | null>;
  /** Server-assigned attachment id, null while the relay handshake is in flight. */
  readonly connectionId$: Observable<string | null>;
  /** Current driver clientId observed via SessionEvent; null when no one drives. */
  readonly driverId$: Observable<string | null>;

  write(data: string | Uint8Array): Promise<void>;
  resize(rows: number, cols: number): Promise<void>;
  close(): Promise<void>;
  /** Send a JSON Control message (driver_request / driver_release / heartbeat / ...). */
  sendControl(message: object): Promise<void>;
}

/**
 * Joiner-side N-session container — sibling of ISSHSessionService and
 * IPTYSessionService. Renderer-side facade and main-process implementation
 * both implement this contract.
 */
export interface IRemoteSessionService {
  readonly sessions$: Observable<readonly string[]>;
  readonly sessionCreated$: Observable<IRemoteSessionCreatedEvent>;
  readonly sessionClosed$: Observable<IRemoteSessionClosedEventNotify>;
  getSessions(): readonly string[];

  data$(sessionId: string): Observable<Uint8Array>;
  status$(sessionId: string): Observable<RemoteSessionStatus>;
  event$(sessionId: string): Observable<RemoteSessionEvent>;
  error$(sessionId: string): Observable<string | null>;
  connectionId$(sessionId: string): Observable<string | null>;
  driverId$(sessionId: string): Observable<string | null>;

  createSession(options: IRemoteSessionCreateOptions): Promise<IRemoteSessionCreateResult>;
  closeSession(sessionId: string): Promise<void>;
  write(sessionId: string, data: string | Uint8Array): Promise<void>;
  resize(sessionId: string, rows: number, cols: number): Promise<void>;
  sendControl(sessionId: string, message: object): Promise<void>;
}

export const IRemoteSessionService = createIdentifier<IRemoteSessionService>(
  'shared-terminal.remote-session-service'
);
