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
import type { ICollabInvite, IInviteClaimResult, IInviteCreateOptions } from '../models/invite';
import type { IPairedDevice } from '../models/pairing';
import { createIdentifier } from '@termlnk/core';

/**
 * Owner-side pairing: account-scoped session attach + cross-account invites.
 * Does not participate in PTY frame transport — that is IPtyMultiplexerService's job.
 */
export interface IPairingService {
  readonly pairedDevices$: Observable<readonly IPairedDevice[]>;
  readonly outstandingInvites$: Observable<readonly ICollabInvite[]>;

  revokeDevice(deviceId: string): Promise<void>;

  /** Create a cross-account invite, returning the invite record and the shareable URL. */
  createInvite(options: IInviteCreateOptions): Promise<{ invite: ICollabInvite; url: string }>;

  revokeInvite(inviteId: string): Promise<void>;

  /** Stream of invite claim results relayed from the relay via the control channel. */
  readonly inviteClaims$: Observable<IInviteClaimResult>;
}

export const IPairingService = createIdentifier<IPairingService>('shared-terminal.pairing-service');
