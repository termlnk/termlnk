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
import type { IFrame } from '../models/frame';
import type { ISharedKey } from '../models/keypair';
import { createIdentifier } from '@termlnk/core';

/**
 * Relay transport abstraction shared by daemon ↔ relay and client ↔ relay. Two implementations
 * target CF Workers + Durable Objects (SaaS) and uWebSockets.js (self-host), sharing the same
 * frame format and control semantics.
 */
export enum TransportState {
  Idle = 'idle',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
  Disconnected = 'disconnected',
  Error = 'error',
}

export interface ITransportConnectOptions {
  readonly relayBaseUrl: string;
  readonly sessionId: string;
  readonly accountToken: string;
  readonly mode: 'daemon' | 'client';
  readonly connectionId?: string;
}

export interface ITransportSendOptions {
  readonly target: string;
}

export interface IInboundFrame {
  readonly source: string;
  readonly frame: IFrame;
}

export interface ISharedTerminalTransportService {
  readonly state$: Observable<TransportState>;
  readonly frames$: Observable<IInboundFrame>;

  connect(options: ITransportConnectOptions, sharedKey: ISharedKey): Promise<void>;
  disconnect(): Promise<void>;
  send(frame: IFrame, options: ITransportSendOptions): void;

  /** Rotate the session key. Daemon mode only. */
  rekey(newSessionKey: Uint8Array): Promise<void>;

  /** Revoke a connection. Daemon mode only. */
  revokeConnection(connectionId: string): Promise<void>;
}

export const ISharedTerminalTransportService = createIdentifier<ISharedTerminalTransportService>(
  'shared-terminal.transport-service'
);
