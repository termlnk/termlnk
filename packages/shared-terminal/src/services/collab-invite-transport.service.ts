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

import type { CollabInviteStatus, ICapability } from '../models/invite';
import type { SharedTerminalRole } from '../models/role';
import { createIdentifier } from '@termlnk/core';

/**
 * REST client for `/v1/collab/invite/*` on termlnk-server.
 *
 * Owner pushes create / revoke events; relay enforces the resulting status on /claim.
 * Bound to authenticated user identity via Bearer access token (handled internally,
 * mirrors HttpSyncTransportService). All methods reject with a typed error on transport
 * failure — PairingService treats failures as soft (offline-first) and retries.
 */
export interface ICollabInviteTransportService {
  pushCreate(input: ICollabInviteCreateInput): Promise<void>;

  pushRevoke(inviteId: string): Promise<void>;

  /** Pull the current server-side view (used by reconciliation). */
  list(): Promise<readonly ICollabInviteServerView[]>;

  /**
   * Claim an invite as the joining device. Server validates capabilityHash
   * against the stored invite, atomically marks it consumed, and returns the
   * connection metadata the joiner needs to attach to the relay — including
   * an optional one-shot `relayClaimToken` for cross-account joiners.
   */
  claim(inviteId: string, input: ICollabInviteClaimInput): Promise<ICollabInviteClaimResponse>;
}

export const ICollabInviteTransportService = createIdentifier<ICollabInviteTransportService>(
  'shared-terminal.collab-invite-transport.service'
);

/** Payload sent to POST /v1/collab/invite. ephPriv is NEVER transmitted to the server. */
export interface ICollabInviteCreateInput {
  readonly inviteId: string;
  readonly sessionId: string;
  readonly role: SharedTerminalRole;
  readonly capability: ICapability;
  readonly capabilityHash: string;
  /** base64url X25519 public key — server stores so /claim can validate envelope. */
  readonly ephPubB64: string;
  /** ms epoch. */
  readonly exp: number;
  readonly singleUse: boolean;
  readonly note?: string;
}

export interface ICollabInviteServerView {
  readonly inviteId: string;
  readonly sessionId: string;
  readonly role: SharedTerminalRole;
  readonly capabilityHash: string;
  readonly exp: number;
  readonly singleUse: boolean;
  readonly status: CollabInviteStatus;
  /** ISO timestamp on the server. */
  readonly createdAt: string;
  readonly consumedAt?: string;
  readonly revokedAt?: string;
}

/** Payload sent to POST /v1/collab/invite/:id/claim. */
export interface ICollabInviteClaimInput {
  readonly capabilityHash: string;
  readonly displayName?: string;
}

export interface ICollabInviteClaimResponse {
  readonly sessionId: string;
  readonly ephPubB64: string;
  readonly role: SharedTerminalRole;
  readonly connectionId: string;
  readonly consumedAt: string;
  /** One-shot HMAC; present only for cross-account claims. */
  readonly relayClaimToken?: string;
}
