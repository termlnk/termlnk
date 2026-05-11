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
import type { ClientConnectionState, DaemonState } from '../models/session';
import { createIdentifier } from '@termlnk/core';

/**
 * High-level entry point for daemon / client orchestration. Upper layers (UI, bootstrap) use
 * this instead of directly wiring transport, pairing, and multiplexer services.
 */
export interface ISharedTerminalService {
  readonly daemonState$: Observable<DaemonState>;
  readonly clientState$: Observable<ClientConnectionState>;
  readonly lastError$: Observable<ISharedTerminalError | null>;

  startDaemon(): Promise<void>;
  stopDaemon(): Promise<void>;
  connectAsClient(options: { sessionId: string; inviteUrl?: string }): Promise<void>;
  disconnectClient(): Promise<void>;
}

export interface ISharedTerminalError {
  readonly code: SharedTerminalErrorCode;
  readonly message: string;
  /** Stringified cause to survive IPC serialization. */
  readonly cause?: string;
}

export type SharedTerminalErrorCode =
  | 'keypair_unavailable'
  | 'relay_unreachable'
  | 'invite_invalid'
  | 'invite_expired'
  | 'session_rejected'
  | 'rate_limited'
  | 'crypto_failure'
  | 'unknown';

export const ISharedTerminalService = createIdentifier<ISharedTerminalService>(
  'shared-terminal.service'
);
