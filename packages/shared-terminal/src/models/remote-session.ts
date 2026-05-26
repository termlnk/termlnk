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

import type { SharedTerminalRole } from './role';

/**
 * Lifecycle of a joiner-side attachment, modeled to align with SSHSessionStatus /
 * PTYSessionStatus so renderer code can treat all three terminal types uniformly.
 */
export enum RemoteSessionStatus {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  CLOSED = 'closed',
  ERROR = 'error',
}

/**
 * Structured projection of inbound SessionEvent frames decoded inside the main
 * process. The renderer subscribes to `event$` instead of raw frames, so it
 * never has to switch on a `channel` byte or base64-decode a payload.
 */
export type RemoteSessionEvent =
  | IRemoteSnapshotEvent
  | IRemoteResizeEvent
  | IRemoteSessionMetadataEvent
  | IRemoteDriverHandoverEvent
  | IRemoteParticipantJoinedEvent
  | IRemoteParticipantLeftEvent
  | IRemoteSessionClosedEvent;

export interface IRemoteSnapshotEvent {
  readonly type: 'snapshot';
  readonly cols: number;
  readonly rows: number;
  readonly serialized: string;
  readonly observedSeq: number;
}

/**
 * Owner-side PTY geometry change. Joiner xterm must resize to match so
 * cursor/wrap math and clear-line escapes in subsequent PtyData replay
 * against the same dimensions zsh / bash used to emit them.
 */
export interface IRemoteResizeEvent {
  readonly type: 'resize';
  readonly cols: number;
  readonly rows: number;
}

/**
 * Owner-pushed session metadata as the joiner sees it. RemoteSession merges
 * incoming deltas with its prior cache before emitting, so consumers always
 * observe the *current* metadata snapshot — never a partial delta. Missing
 * fields mean "the owner has not set this field".
 */
export interface IRemoteSessionMetadataEvent {
  readonly type: 'session_metadata';
  readonly ownerLabel?: string;
  readonly title?: string;
}

export interface IRemoteDriverHandoverEvent {
  readonly type: 'driver_handover';
  readonly fromClientId: string | null;
  readonly toClientId: string | null;
}

export interface IRemoteParticipantJoinedEvent {
  readonly type: 'participant_joined';
  readonly clientId: string;
  readonly role: SharedTerminalRole;
  readonly displayName?: string;
}

export interface IRemoteParticipantLeftEvent {
  readonly type: 'participant_left';
  readonly clientId: string;
}

export interface IRemoteSessionClosedEvent {
  readonly type: 'session_closed';
}
