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
 * Session-wide input policy decided by the owner at share-start time.
 *
 * - `view-only`   — joiners may observe but never write. The "request keyboard"
 *                   affordance is hidden in the joiner UI and the daemon silently
 *                   rejects driver_request frames.
 * - `allow-input` — joiners may take the keyboard via the single-driver soft
 *                   lock. Default for backward compatibility with old invite
 *                   URLs that predate this field.
 *
 * Bound to a session, not an invite. Changing the policy requires stopping the
 * share and starting a new one — keeps the model aligned with Termius and
 * sidesteps mid-flight permission churn.
 */
export type ISharedSessionInputPolicy = 'view-only' | 'allow-input';

/**
 * Daemon-level state machine:
 * not started → starting → waiting for relay → registering PTY → online.
 */
export enum DaemonState {
  Inactive = 'inactive',
  Starting = 'starting',
  AwaitingRelay = 'awaiting_relay',
  Online = 'online',
  Error = 'error',
}

/** Client-side connection state: before, during, and after pairing. */
export enum ClientConnectionState {
  Idle = 'idle',
  Pairing = 'pairing',
  Connecting = 'connecting',
  Connected = 'connected',
  Disconnected = 'disconnected',
  Error = 'error',
}

/**
 * State of an SSH/PTY session that is being broadcast for collaboration.
 *
 * - **Idle**: the PTY is running but nobody besides the owner is attached.
 * - **Active**: at least one client is attached.
 * - **Closed**: the PTY has exited.
 */
export enum SharedSessionState {
  Idle = 'idle',
  Active = 'active',
  Closed = 'closed',
}

/** A PTY session being broadcast — as seen by the daemon. */
export interface ISharedSession {
  /** Session ID (1:1 with the termlnk SSH session ID). */
  readonly id: string;
  /** User-facing title (host name or e.g. `"ssh prod-bastion"`). */
  readonly title: string;
  readonly state: SharedSessionState;
  /** Terminal column count. */
  readonly cols: number;
  /** Terminal row count. */
  readonly rows: number;
  /** Creation time (epoch ms). */
  readonly createdAt: number;
  /** IDs of every attached client, including the owner. */
  readonly participantIds: readonly string[];
  /** Current driver client ID; null means no one holds the keyboard. */
  readonly driverId: string | null;
  /** Owner-chosen input policy for this share. */
  readonly inputPolicy: ISharedSessionInputPolicy;
}

/**
 * Snapshot the client receives on attach — used to restore terminal state.
 *
 * The serialized field carries the complete xterm-headless state (cursor,
 * SGR, scrollback). Sending it in one shot on reconnect avoids the visual
 * tearing of replaying byte-by-byte over a flaky link.
 */
export interface ISessionSnapshot {
  readonly sessionId: string;
  readonly title: string;
  readonly cols: number;
  readonly rows: number;
  /** ANSI byte string produced by xterm-addon-serialize; safe to write directly to the client's xterm. */
  readonly serialized: string;
  /** Highest ptyData seq observed for this session at snapshot time; clients resume from seq+1. */
  readonly observedSeq: number;
  readonly state: SharedSessionState;
  readonly driverId: string | null;
  readonly inputPolicy: ISharedSessionInputPolicy;
}

/**
 * Participant view — surfaced to clients and the UI.
 *
 * Distinct from `IPairedDevice`: a paired device is a client that has
 * paired at some point; a participant is an active connection currently
 * attached to a session, and is much shorter-lived.
 */
export interface IParticipant {
  readonly connectionId: string;
  readonly displayName: string;
  readonly role: SharedTerminalRole;
  readonly joinedAt: number;
  readonly isCurrent: boolean;
}
