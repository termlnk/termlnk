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
 * Invite + paired-device lifecycle. Drives the owner-side "create invite",
 * "revoke invite", "list invites" UX, and the joiner-side "deep link arrived"
 * stream (`inviteUrl$`).
 *
 * Same contract on both sides — main process implements against PairingService
 * + DeepLinkRouterService; renderer routes through the tRPC invite router.
 */
export interface IInviteService {
  // Owner-side invite lifecycle
  readonly outstandingInvites$: Observable<readonly IInviteTokenState[]>;
  readonly inviteHistory$: Observable<readonly IInviteTokenState[]>;
  readonly inviteClaims$: Observable<IInviteClaimResult>;

  createInvite(options: IInviteCreateOptions): Promise<{ invite: ICollabInvite; url: string }>;
  revokeInvite(inviteId: string): Promise<void>;
  listInvites(): Promise<readonly IInviteTokenState[]>;

  // Paired devices (same-account fan-out)
  readonly pairedDevices$: Observable<readonly IPairedDevice[]>;
  revokeDevice(deviceId: string): Promise<void>;

  // Deep-link intake (OS-level termlnk:// URLs forwarded from electron-main)
  readonly inviteUrl$: Observable<string>;
}

export const IInviteService = createIdentifier<IInviteService>(
  'shared-terminal.invite-service'
);
