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

export type CollabInviteStatus = 'active' | 'consumed' | 'revoked' | 'expired';

/**
 * Capability declaration embedded in an invite URL fragment. The relay only sees the hash
 * for audit/rate-limiting; the plaintext stays client-side. Capability is NOT a decryption key —
 * decryption uses ephemeral X25519 wrapping via ICollabInvite.ephPriv combined with daemonPub
 * below to derive the per-invite sharedKey.
 *
 * Hashing note: `daemonPub` is **not** included in the canonical hash (see capability-hash.ts).
 * The hash signs the access metadata (sid/role/exp/nonce) so the relay can dedupe; the key
 * material rides the fragment which the relay never sees.
 */
export interface ICapability {
  readonly v: number;
  readonly sid: string;
  readonly role: SharedTerminalRole;
  readonly exp: number;
  readonly nonce: string;
  /** Daemon long-term X25519 public key (base64url, 32 bytes). The joiner combines this with
   *  the fragment's ephPriv to derive sharedKey — without this, decryption would fall back
   *  to an all-zero key and every relay frame would fail to open. */
  readonly daemonPub: string;
}

/**
 * Collaboration invite encoded into the URL fragment. The fragment carries the real key material;
 * the inviteId is only a relay-side index. The fragment is never sent to the server.
 *
 * URL: `https://invite.termlnk.io/s/<inviteId>#<base64url(ephPriv || capability)>`
 */
export interface ICollabInvite {
  readonly inviteId: string;
  /** Ephemeral X25519 private key (base64url) — only in the URL fragment. */
  readonly ephPriv: string;
  readonly ephPub: string;
  readonly capability: ICapability;
  readonly singleUse: boolean;
  readonly capabilityHash?: string;
  readonly createdAt?: number;
  readonly status?: CollabInviteStatus;
  readonly consumedAt?: number;
  readonly revokedAt?: number;
}

/** Claim payload the invitee sends to the relay, wrapped in the ephemeral channel. */
export interface IInviteClaimPayload {
  readonly inviteId: string;
  /** Invitee's long-term public key (32 bytes, base64url). The daemon combines it with its own secret to derive a sharedKey and distribute the sessionKey. */
  readonly userPubkey: string;
  /** Encrypted capability payload sent to the relay; the daemon validates it against the original `inviteId`. */
  readonly capabilityCipher: string;
  /** Display name the invitee reports — shown in the owner's UI. */
  readonly displayName?: string;
}

/** Invite claim result. */
export interface IInviteClaimResult {
  readonly inviteId: string;
  /** Server-assigned connection ID; used for per-connection revocation. */
  readonly connectionId: string;
  /** Whether the invite is still usable, expired, consumed or revoked. */
  readonly status: 'accepted' | 'expired' | 'consumed' | 'revoked' | 'invalid';
  readonly reason?: string;
}

export interface IInviteTokenState {
  readonly inviteId: string;
  readonly sessionId: string;
  readonly role: SharedTerminalRole;
  readonly capabilityHash: string;
  readonly exp: number;
  readonly singleUse: boolean;
  readonly status: CollabInviteStatus;
  readonly createdAt: number;
  readonly consumedAt?: number;
  readonly revokedAt?: number;
  /** Owner-supplied label for the invite (optional). */
  readonly note?: string;
}

/** Invite creation parameters. */
export interface IInviteCreateOptions {
  readonly sessionId?: string;
  readonly role: SharedTerminalRole;
  readonly ttlMs: number;
  readonly singleUse: boolean;
  readonly note?: string;
}
