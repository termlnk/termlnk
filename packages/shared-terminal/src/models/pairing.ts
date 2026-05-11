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

/** Persisted paired-device record on the daemon side. */
export interface IPairedDevice {
  readonly id: string;
  readonly displayName?: string;
  readonly clientPubkey: string;
  readonly userAgentHint?: string;
  readonly origin: 'account' | 'invite';
  readonly pairedAt: number;
  readonly lastSeenAt: number;
  readonly online: boolean;
}

export interface ISessionClaimPayload {
  readonly type: 'session_claim';
  readonly sessionId: string;
  readonly clientPubkey: string;
  readonly accountToken: string;
  readonly displayName?: string;
  readonly userAgentHint?: string;
}

export interface ISessionAcceptPayload {
  readonly type: 'session_accept';
  readonly deviceId: string;
  /** Session key wrapped for this client via NaCl box. */
  readonly sessionKeyEnvelope: string;
}

export interface ISessionRejectPayload {
  readonly type: 'session_reject';
  readonly reason: 'invalid_token' | 'account_mismatch' | 'expired' | 'rate_limited' | 'unknown';
  readonly message?: string;
}
