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
import type { IFrame } from '../models/frame';
import type { SharedTerminalRole } from '../models/role';
import type { IParticipant, ISessionSnapshot, ISharedSession } from '../models/session';
import { createIdentifier } from '@termlnk/core';

/** Real PTY source bridged into the multiplexer without a reverse dependency on @termlnk/rpc-server. */
export interface IPtySource {
  readonly id: string;
  readonly cols: number;
  readonly rows: number;
  readonly title: string;
  readonly output$: Observable<Uint8Array>;
  write(data: Uint8Array): void;
  resize(cols: number, rows: number): void;
}

/**
 * PTY multiplexer — fans out one PTY to multiple attached clients.
 * Per session: one xterm-headless instance, a 2 MiB ring buffer, and driver arbitration.
 */
export interface IOutboundFrame {
  readonly sessionId: string;
  /** 'broadcast' or a specific clientId. */
  readonly target: string;
  readonly frame: IFrame;
}

export interface IPtyMultiplexerService {
  readonly sessions$: Observable<readonly ISharedSession[]>;

  /** Global outbound stream — the transport subscribes to this and routes frames by target. */
  readonly outbound$: Observable<IOutboundFrame>;

  driverState$(sessionId: string): Observable<IDriverState>;
  participants$(sessionId: string): Observable<readonly IParticipant[]>;

  register(source: IPtySource): IRegisteredPty;
  snapshot(sessionId: string): Promise<ISessionSnapshot>;

  setDriver(sessionId: string, clientId: string | null): void;
  lockDriver(sessionId: string, clientId: string): void;
  unlockDriver(sessionId: string): void;
  kick(sessionId: string, clientId: string, reason?: string): void;

  /**
   * Attach a participant. Optional `publicKey` registers the client's X25519
   * public key so the daemon can wrap the per-session symmetric key for them on
   * subsequent rekeys. Omit for legacy paired-device flows (no rekey participation).
   */
  attachClient(sessionId: string, clientId: string, role: SharedTerminalRole, displayName?: string, publicKey?: Uint8Array): void;
  detachClient(sessionId: string, clientId: string): void;

  /**
   * Handle an inbound frame from a client. PtyData reaches the PTY only when the sender is
   * the current driver. SessionEvent from clients is ignored to prevent spoofing.
   */
  handleInbound(sessionId: string, clientId: string, frame: IFrame): void;

  clientHeartbeat(sessionId: string, clientId: string): void;

  /**
   * Current per-session symmetric key (32 bytes) used to encrypt PTY frames.
   * Generated lazily on the first attach with a registered publicKey; null when no
   * keyed participant has joined yet.
   */
  getSessionKey(sessionId: string): Uint8Array | null;

  /**
   * Hot stream of the current session key for a given sessionId.
   *
   * Daemon-side bridges (e.g. ShareDaemonService) subscribe to this to keep their
   * outbound RelayTransport's encryption key in sync with mux's wrap-and-broadcast
   * cycle. Emits whenever the key transitions — initial value (null), first attach
   * generation, kick/detach-triggered rotation, manual rekey, and back to null on
   * session destroy.
   *
   * Ordering guarantee: when mux generates a new key in response to attach/detach,
   * the corresponding wrapped control frame is pushed to `outbound$` BEFORE
   * `sessionKey$` emits, so the bridge can transmit the rekey frame with the old
   * key before swapping its own encryption key.
   */
  sessionKey$(sessionId: string): Observable<Uint8Array | null>;

  /**
   * Rotate the session key, broadcasting the new key wrapped per-recipient via NaCl box
   * (daemon long-term private + recipient public key). Returns the count of recipients
   * we successfully wrapped for; clients without a registered pubkey are skipped.
   *
   * Triggered automatically on kick and on the detach of any participant. Caller may
   * also invoke manually (settings UI "rotate key now").
   */
  rekey(sessionId: string, reason: RekeyReason): Promise<IRekeyResult>;
}

export type RekeyReason = 'manual' | 'kick' | 'detach';

export interface IRekeyResult {
  readonly sessionId: string;
  readonly reason: RekeyReason;
  readonly recipientCount: number;
  /** Skipped because no publicKey was registered at attach time. */
  readonly unwrappedClientIds: readonly string[];
}

export interface IRegisteredPty {
  readonly sessionId: string;
  unregister(): void;
}

export const IPtyMultiplexerService = createIdentifier<IPtyMultiplexerService>(
  'shared-terminal.pty-multiplexer-service'
);
