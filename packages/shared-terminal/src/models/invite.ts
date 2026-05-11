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
 * decryption uses ephemeral X25519 wrapping via ICollabInvite.ephPriv.
 */
export interface ICapability {
  readonly v: number;
  readonly sid: string;
  readonly role: SharedTerminalRole;
  readonly exp: number;
  readonly nonce: string;
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
  /** 受邀者长期公钥（base64url 32 bytes）——daemon 用此 + 自己 secret 派生 sharedKey 给该用户分发 sessionKey */
  readonly userPubkey: string;
  /** capability 明文（重新加密发到 relay；daemon 用 ephPub+? 校验对应 inviteId 一致）*/
  readonly capabilityCipher: string;
  /** 受邀者上报的显示名（UI 给 owner 看） */
  readonly displayName?: string;
}

/** Invite claim result. */
export interface IInviteClaimResult {
  readonly inviteId: string;
  /** 服务端分配的 connectionId（per-connection 撤销用） */
  readonly connectionId: string;
  /** 邀请仍可用 / 已过期 / 已被消费 / 被撤销 */
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
}

/** Invite creation parameters. */
export interface IInviteCreateOptions {
  readonly sessionId?: string;
  readonly role: SharedTerminalRole;
  readonly ttlMs: number;
  readonly singleUse: boolean;
  readonly note?: string;
}
