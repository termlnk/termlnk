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
import type { ICollabInvite, IInviteClaimResult, IInviteCreateOptions, IInviteTokenState } from '../models/invite';
import type { IPairedDevice } from '../models/pairing';
import { createIdentifier } from '@termlnk/core';

/**
 * Owner-side pairing: account-scoped session attach + cross-account invites.
 * Does not participate in PTY frame transport — that is IPtyMultiplexerService's job.
 *
 * Token lifecycle (P5.5.2): every invite ever minted is persisted (collab_invite_token table)
 * and progresses through active → consumed | revoked | expired. The observables expose the
 * UI-safe IInviteTokenState (no ephPriv), while createInvite returns the full ICollabInvite +
 * shareable URL exactly once at creation time for the owner to copy.
 */
export interface IPairingService {
  readonly pairedDevices$: Observable<readonly IPairedDevice[]>;

  /** Live stream of active invites only. UI-safe (no ephemeral private key). */
  readonly outstandingInvites$: Observable<readonly IInviteTokenState[]>;

  /** Live stream of every invite the owner has minted, regardless of status. */
  readonly inviteHistory$: Observable<readonly IInviteTokenState[]>;

  revokeDevice(deviceId: string): Promise<void>;

  /**
   * Create a cross-account invite. Returns the full ICollabInvite (with ephPriv) so the
   * caller can build the shareable URL once; ephPriv is persisted encrypted on disk and
   * never re-exposed afterwards. URL fragment carries the ephPriv off-band.
   */
  createInvite(options: IInviteCreateOptions): Promise<{ invite: ICollabInvite; url: string }>;

  revokeInvite(inviteId: string): Promise<void>;

  /** One-shot read of the full invite list (for non-reactive callers like tRPC queries). */
  listInvites(): Promise<readonly IInviteTokenState[]>;

  /** Stream of invite claim results relayed from the relay via the control channel. */
  readonly inviteClaims$: Observable<IInviteClaimResult>;
}

export const IPairingService = createIdentifier<IPairingService>('shared-terminal.pairing-service');
