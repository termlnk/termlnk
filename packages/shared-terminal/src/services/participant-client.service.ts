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
import type { ClientConnectionState } from '../models/session';
import { createIdentifier } from '@termlnk/core';

/** Frame payload as seen by the renderer-side RemoteTerminalView. */
export interface IParticipantFrame {
  /** 1 = PtyData / 0 = Control / 2 = SessionEvent (mirrors FrameChannel enum). */
  readonly channel: number;
  /** base64-encoded raw bytes for PtyData; UTF-8 JSON for Control / SessionEvent. */
  readonly payloadBase64: string;
  /** Sequence number, monotonic per channel. */
  readonly seq: number;
}

/** Snapshot delivered immediately after attach. */
export interface IParticipantSnapshot {
  readonly sessionId: string;
  readonly cols: number;
  readonly rows: number;
  readonly serialized: string;
  readonly observedSeq: number;
}

export interface IParticipantConnectInput {
  readonly inviteUrl: string;
}

export interface IParticipantConnectResult {
  readonly sessionId: string;
  readonly connectionId: string;
  readonly snapshot?: IParticipantSnapshot;
}

/**
 * Owner-process service that drives the joiner side of a multiplayer session.
 *
 * Renderer triggers `connect(inviteUrl)`; the implementation parses the invite,
 * negotiates the session key with the relay, and starts streaming inbound frames.
 * The `frames$` stream is consumed by the renderer's RemoteTerminalView.
 *
 * Lives in shared-terminal contract layer so both rpc-server (impl) and
 * rpc-client (facade) can share the type without circular deps.
 */
export interface IParticipantService {
  readonly state$: Observable<ClientConnectionState>;
  readonly frames$: Observable<IParticipantFrame>;
  readonly snapshot$: Observable<IParticipantSnapshot | null>;
  readonly lastError$: Observable<string | null>;

  connect(input: IParticipantConnectInput): Promise<IParticipantConnectResult>;
  disconnect(): Promise<void>;
}

export const IParticipantService = createIdentifier<IParticipantService>(
  'shared-terminal.participant-client-service'
);
