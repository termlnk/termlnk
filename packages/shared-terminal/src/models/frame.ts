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

/**
 * Logical channel for multiplexed frames. Each channel has an independent monotonic seq counter
 * so ordering is guaranteed within a channel without head-of-line blocking across channels.
 */
import type { ICapability } from './invite';
import type { SharedTerminalRole } from './role';
import type { ISessionSnapshot } from './session';

export enum FrameChannel {
  Control = 0,
  PtyData = 1,
  SessionEvent = 2,
}

/**
 * Frame flag bitmask.
 *
 * - bit 0: AckRequired — receiver must send an ack frame.
 * - bit 1: Compressed  — payload is zstd-compressed.
 * - bit 2: EndOfStream — last fragment of a split sequence.
 * - bits 3..7: Reserved — receivers MUST ignore unknown bits.
 */
export enum FrameFlag {
  None = 0,
  AckRequired = 1,
  Compressed = 2,
  EndOfStream = 4,
}

/** Plaintext logical frame before encryption. See IFrameCodecService for the encode path. */
export interface IFrame {
  readonly channel: FrameChannel;
  readonly flags: number;
  /** Monotonically-increasing 32-bit seq within this channel. */
  readonly seq: number;
  readonly payload: Uint8Array;
}

/** Control-channel event types. Payload is UTF-8 JSON; receivers dispatch on type. */
export const CONTROL_MESSAGE_TYPES = [
  'session_claim',
  'session_accept',
  'session_reject',
  'invite_claim',
  'invite_accept',
  'invite_reject',
  'driver_request',
  'driver_handover',
  'driver_release',
  'driver_lock',
  'driver_unlock',
  'rekey',
  'kick',
  'heartbeat',
  'resize',
  'error',
] as const;
export type ControlMessageType = (typeof CONTROL_MESSAGE_TYPES)[number];

export interface IControlMessageBase {
  readonly type: ControlMessageType;
  readonly sessionId?: string;
}

export interface IInviteClaimControlMessage extends IControlMessageBase {
  readonly type: 'invite_claim';
  readonly sessionId: string;
  readonly inviteId: string;
  readonly connectionId: string;
  readonly userPubkey: string;
  readonly capability: ICapability;
  readonly displayName?: string;
}

export interface IInviteAcceptControlMessage extends IControlMessageBase {
  readonly type: 'invite_accept';
  readonly sessionId: string;
  readonly inviteId: string;
  readonly connectionId: string;
  readonly role: SharedTerminalRole;
  readonly wrappedSessionKey: string;
}

export interface IInviteRejectControlMessage extends IControlMessageBase {
  readonly type: 'invite_reject';
  readonly sessionId: string;
  readonly inviteId: string;
  readonly reason: 'expired' | 'consumed' | 'revoked' | 'invalid' | 'not_owner';
}

export interface IDriverRequestControlMessage extends IControlMessageBase {
  readonly type: 'driver_request';
  readonly sessionId?: string;
}

export interface IDriverHandoverControlMessage extends IControlMessageBase {
  readonly type: 'driver_handover';
  readonly sessionId: string;
  readonly fromClientId: string | null;
  readonly toClientId: string | null;
}

export interface IDriverReleaseControlMessage extends IControlMessageBase {
  readonly type: 'driver_release';
  readonly sessionId?: string;
}

export interface IDriverLockControlMessage extends IControlMessageBase {
  readonly type: 'driver_lock';
  readonly sessionId: string;
  readonly clientId: string;
}

export interface IDriverUnlockControlMessage extends IControlMessageBase {
  readonly type: 'driver_unlock';
  readonly sessionId: string;
}

export interface IRekeyControlMessage extends IControlMessageBase {
  readonly type: 'rekey';
  readonly sessionId: string;
  readonly epoch: number;
  readonly wrappedKeys: readonly {
    readonly connectionId: string;
    readonly wrappedSessionKey: string;
  }[];
}

export interface IKickControlMessage extends IControlMessageBase {
  readonly type: 'kick';
  readonly sessionId?: string;
  readonly connectionId?: string;
  readonly reason?: string;
}

export interface IHeartbeatControlMessage extends IControlMessageBase {
  readonly type: 'heartbeat';
  readonly sessionId?: string;
  readonly at?: number;
}

export interface IResizeControlMessage extends IControlMessageBase {
  readonly type: 'resize';
  readonly sessionId?: string;
  readonly cols: number;
  readonly rows: number;
}

export interface IErrorControlMessage extends IControlMessageBase {
  readonly type: 'error';
  readonly sessionId?: string;
  readonly code: string;
  readonly message: string;
}

export type IControlMessage =
  | IInviteClaimControlMessage
  | IInviteAcceptControlMessage
  | IInviteRejectControlMessage
  | IDriverRequestControlMessage
  | IDriverHandoverControlMessage
  | IDriverReleaseControlMessage
  | IDriverLockControlMessage
  | IDriverUnlockControlMessage
  | IRekeyControlMessage
  | IKickControlMessage
  | IHeartbeatControlMessage
  | IResizeControlMessage
  | IErrorControlMessage
  | (IControlMessageBase & {
    readonly type: 'session_claim' | 'session_accept' | 'session_reject';
    readonly [key: string]: unknown;
  });

/** Session-channel event types. Payload is UTF-8 JSON consumed by the UI. */
export const SESSION_EVENT_TYPES = [
  'invite_created',
  'invite_consumed',
  'invite_revoked',
  'participant_joined',
  'participant_left',
  'participant_kicked',
  'role_changed',
  'driver_handover',
  'rekey',
  'session_started',
  'session_closed',
  'snapshot',
] as const;
export type SessionEventType = (typeof SESSION_EVENT_TYPES)[number];

export interface ISessionEventBase {
  readonly type: SessionEventType;
  readonly sessionId: string;
}

export interface IParticipantJoinedSessionEvent extends ISessionEventBase {
  readonly type: 'participant_joined';
  readonly clientId: string;
  readonly role: SharedTerminalRole;
  readonly displayName?: string;
}

export interface IParticipantLeftSessionEvent extends ISessionEventBase {
  readonly type: 'participant_left';
  readonly clientId: string;
}

export interface IParticipantKickedSessionEvent extends ISessionEventBase {
  readonly type: 'participant_kicked';
  readonly clientId: string;
  readonly reason?: string;
}

export interface IRoleChangedSessionEvent extends ISessionEventBase {
  readonly type: 'role_changed';
  readonly clientId: string;
  readonly fromRole: SharedTerminalRole;
  readonly toRole: SharedTerminalRole;
}

export interface IDriverHandoverSessionEvent extends ISessionEventBase {
  readonly type: 'driver_handover';
  readonly fromClientId: string | null;
  readonly toClientId: string | null;
}

export interface IInviteSessionEvent extends ISessionEventBase {
  readonly type: 'invite_created' | 'invite_consumed' | 'invite_revoked';
  readonly inviteId: string;
  readonly role: SharedTerminalRole;
}

export interface IRekeySessionEvent extends ISessionEventBase {
  readonly type: 'rekey';
  readonly epoch: number;
  readonly reason: 'kick' | 'role_changed' | 'manual' | 'rotate';
}

export interface ISessionLifecycleEvent extends ISessionEventBase {
  readonly type: 'session_started' | 'session_closed';
}

export interface ISnapshotSessionEvent extends ISessionEventBase, ISessionSnapshot {
  readonly type: 'snapshot';
}

export type ISessionEvent =
  | IParticipantJoinedSessionEvent
  | IParticipantLeftSessionEvent
  | IParticipantKickedSessionEvent
  | IRoleChangedSessionEvent
  | IDriverHandoverSessionEvent
  | IInviteSessionEvent
  | IRekeySessionEvent
  | ISessionLifecycleEvent
  | ISnapshotSessionEvent;
