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
import type { IDriverState } from '../models/driver';
import type { ICollabInvite, IInviteClaimResult, IInviteCreateOptions, IInviteTokenState } from '../models/invite';
import type { IPairedDevice } from '../models/pairing';
import type { ClientConnectionState, IParticipant, ISharedSession } from '../models/session';
import type { IRemoteAnnouncedSession } from './device-pairing.service';
import type { IParticipantConnectResult, IParticipantFrame, IParticipantSessionMetadata, IParticipantSnapshot } from './participant-client.service';
import { createIdentifier } from '@termlnk/core';

/**
 * Owner-side view of an active local PTY / SSH session. The renderer uses this to
 * render the "share this session" list — every active session is reported, with
 * a `shared` flag flipped once the owner toggles sharing on.
 */
export interface IShareableSession {
  readonly sessionId: string;
  readonly kind: 'ssh' | 'local';
  readonly title: string;
  readonly hostId?: string;
  readonly shared: boolean;
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

/**
 * Single facade for shared terminal (multiplayer) features.
 *
 * One contract, two implementations — main process (rpc-server / shared-terminal-core)
 * implements every method against local services (PtyMultiplexerService, PairingService,
 * ShareSessionService, etc.); the renderer (rpc-client) implements the same contract
 * by routing every call through the tRPC multiplayer router. Components inject
 * `ISharedTerminalService` and never know which side they are on.
 */
export interface ISharedTerminalService {
  // Sessions

  readonly sessions$: Observable<readonly ISharedSession[]>;
  listSessions(): Promise<readonly ISharedSession[]>;

  participants$(sessionId: string): Observable<readonly IParticipant[]>;
  driverState$(sessionId: string): Observable<IDriverState>;

  // Driver arbitration

  setDriver(sessionId: string, clientId: string | null): Promise<void>;
  lockDriver(sessionId: string, clientId: string): Promise<void>;
  unlockDriver(sessionId: string): Promise<void>;
  kick(sessionId: string, clientId: string, reason?: string): Promise<void>;

  // Invites (owner-side lifecycle)

  readonly outstandingInvites$: Observable<readonly IInviteTokenState[]>;
  readonly inviteHistory$: Observable<readonly IInviteTokenState[]>;
  readonly inviteClaims$: Observable<IInviteClaimResult>;

  createInvite(options: IInviteCreateOptions): Promise<{ invite: ICollabInvite; url: string }>;
  revokeInvite(inviteId: string): Promise<void>;
  listInvites(): Promise<readonly IInviteTokenState[]>;

  // Paired devices (same-account fan-out)

  readonly pairedDevices$: Observable<readonly IPairedDevice[]>;
  revokeDevice(deviceId: string): Promise<void>;

  // Sharing lifecycle (which local/SSH sessions are exposed to multiplayer)

  readonly shareable$: Observable<readonly IShareableSession[]>;
  listShareable(): Promise<readonly IShareableSession[]>;

  shareSshSession(sessionId: string): Promise<void>;
  sharePtySession(sessionId: string): Promise<void>;
  stopSharing(sessionId: string): Promise<void>;

  // Deep link intake (termlnk:// invite URLs forwarded from electron-main)

  /**
   * Stream of incoming OS deep-link URLs. Renderer subscribes to drive the
   * "you've been invited" join-dialog UX.
   */
  readonly inviteUrl$: Observable<string>;

  // Participant (joiner) side: multi-session attachments to shared sessions.

  /** SessionIds of every active participant attachment. */
  readonly participantSessions$: Observable<readonly string[]>;

  participantState$(sessionId: string): Observable<ClientConnectionState>;
  participantFrames$(sessionId: string): Observable<IParticipantFrame>;
  participantSnapshot$(sessionId: string): Observable<IParticipantSnapshot | null>;
  participantLastError$(sessionId: string): Observable<string | null>;
  participantConnectionId$(sessionId: string): Observable<string | null>;
  participantMetadata$(sessionId: string): Observable<IParticipantSessionMetadata | null>;

  connectAsParticipant(inviteUrl: string): Promise<IParticipantConnectResult>;
  disconnectParticipant(sessionId: string): Promise<void>;
  /** Forward joiner keystroke bytes to the owner's PTY (driver mode only). */
  sendParticipantInput(sessionId: string, data: Uint8Array): Promise<void>;
  /** Forward a JSON Control message (driver_request / driver_release / resize / ...). */
  sendParticipantControl(sessionId: string, message: object): Promise<void>;

  /**
   * Renderer → daemon: tell the daemon that an owner-side session's visible
   * title has changed (e.g. local PTY OSC update). The daemon forwards the new
   * title to every joiner via a session_metadata SessionEvent so their tab UI
   * stays in sync with the owner's.
   */
  setSharedSessionTitle(sessionId: string, title: string): Promise<void>;

  // Same-account device pairing — sessions announced by the user's other devices

  readonly remoteSessions$: Observable<readonly IRemoteAnnouncedSession[]>;
  listRemoteSessions(): Promise<readonly IRemoteAnnouncedSession[]>;
  refreshRemoteSessions(): Promise<void>;
  announceDeviceSession(sessionId: string, title: string, cols: number, rows: number): Promise<void>;
  retractDeviceSession(sessionId: string): Promise<void>;
}

export const ISharedTerminalService = createIdentifier<ISharedTerminalService>(
  'shared-terminal.service'
);
