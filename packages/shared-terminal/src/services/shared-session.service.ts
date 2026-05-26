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
import type { IParticipant, ISharedSession } from '../models/session';
import { createIdentifier } from '@termlnk/core';

/**
 * Owner-side view of a local PTY / SSH session that can be shared. Every
 * active local terminal appears here; the `shared` flag flips once sharing is
 * toggled on.
 */
export interface IShareableSession {
  readonly sessionId: string;
  readonly kind: 'ssh' | 'local';
  readonly title: string;
  readonly hostId?: string;
  readonly shared: boolean;
}

/**
 * Owner-side control plane: which local sessions are being broadcast, who has
 * joined them, and which joiner holds the keyboard. Renderer code uses this to
 * render the MultiplayerControl popover and to forward title updates.
 *
 * One contract, two implementations — main process implements against
 * PtyMultiplexer + ShareSession services; renderer routes each call through
 * the matching tRPC procedure.
 */
export interface ISharedSessionService {
  // Currently broadcast sessions (as seen by the daemon)
  readonly sessions$: Observable<readonly ISharedSession[]>;
  listSessions(): Promise<readonly ISharedSession[]>;
  participants$(sessionId: string): Observable<readonly IParticipant[]>;
  driverState$(sessionId: string): Observable<IDriverState>;

  // Driver arbitration
  setDriver(sessionId: string, clientId: string | null): Promise<void>;
  lockDriver(sessionId: string, clientId: string): Promise<void>;
  unlockDriver(sessionId: string): Promise<void>;
  kick(sessionId: string, clientId: string, reason?: string): Promise<void>;

  // Sharing lifecycle (which local/SSH sessions are exposed)
  readonly shareable$: Observable<readonly IShareableSession[]>;
  listShareable(): Promise<readonly IShareableSession[]>;
  shareSshSession(sessionId: string): Promise<void>;
  sharePtySession(sessionId: string): Promise<void>;
  stopSharing(sessionId: string): Promise<void>;

  /**
   * Renderer-driven title sync. When the owner-side terminal tab title changes
   * (e.g. OSC update), the renderer forwards the new title here; the daemon
   * pushes a session_metadata SessionEvent to every joiner.
   */
  setSessionTitle(sessionId: string, title: string): Promise<void>;
}

export const ISharedSessionService = createIdentifier<ISharedSessionService>(
  'shared-terminal.shared-session-service'
);
