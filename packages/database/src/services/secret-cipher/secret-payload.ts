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

import { Buffer } from 'node:buffer';
import { SECRET_CIPHER_PREFIX } from '../secret-cipher.service';

export interface ISecretPayload {
  // `string` rather than SecretCipherScheme: payloads may carry schemes this build no longer writes.
  scheme: string;
  iv?: string;
  ciphertext: string;
  tag?: string;
}

// TEMPORARY: the pre-envelope scheme (per-field Electron safeStorage). Remove together with
// the legacy safe-storage migration once users have migrated.
export const LEGACY_SAFE_STORAGE_SCHEME = 'safe-storage';

export function encodeSecretPayload(payload: ISecretPayload): string {
  return SECRET_CIPHER_PREFIX + Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

// Throws on malformed input; callers that must stay tolerant should use tryDecodeSecretPayload.
export function decodeSecretPayload(value: string): ISecretPayload {
  if (!value.startsWith(SECRET_CIPHER_PREFIX)) {
    throw new Error('[SecretPayload] Missing secret cipher prefix');
  }
  const body = value.slice(SECRET_CIPHER_PREFIX.length);
  return JSON.parse(Buffer.from(body, 'base64').toString('utf8')) as ISecretPayload;
}

export function tryDecodeSecretPayload(value: string): ISecretPayload | null {
  try {
    const payload = decodeSecretPayload(value);
    return payload && typeof payload === 'object' && typeof payload.scheme === 'string' ? payload : null;
  } catch {
    return null;
  }
}

export function isLegacySafeStorageValue(value: string): boolean {
  return tryDecodeSecretPayload(value)?.scheme === LEGACY_SAFE_STORAGE_SCHEME;
}
