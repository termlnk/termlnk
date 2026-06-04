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

export type KnownHostVerdict = 'trusted' | 'unknown' | 'changed';

export interface IKnownHost {
  id: string;
  /** Normalized address (no surrounding brackets). */
  host: string;
  port: number;
  /** 'ssh-ed25519' | 'ecdsa-sha2-nistp256' | 'ssh-rsa' ... */
  keyType: string;
  /** 'SHA256:...' without padding; the comparison key. */
  fingerprint: string;
  /** base64 of the raw host key, for re-display / export. */
  publicKey?: string | null;
  lastSeenAt?: string | null;
}

export interface IKnownHostMatch {
  verdict: KnownHostVerdict;
  /** Present when verdict is 'changed': the previously stored record. */
  existing?: IKnownHost;
}

export interface IKnownHostChangeEvent {
  type: 'add' | 'update' | 'delete';
  id: string;
}
