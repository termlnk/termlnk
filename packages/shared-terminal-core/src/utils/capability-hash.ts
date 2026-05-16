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

import type { ICapability } from '@termlnk/shared-terminal';
import { bytesToBase64Url } from './encoding';

/**
 * Stable fingerprint of a capability for relay/server-side dedupe.
 *
 * Canonicalization: JSON with keys serialised in a fixed order (not the runtime insertion
 * order) — different clients building the same capability must produce identical bytes.
 * Hash: SHA-256 via Web Crypto (available in Node 22+, browsers, and React Native via polyfill).
 *
 * NOTE: this is a non-secret fingerprint. The actual access secret is the ephPriv carried
 * inside the URL fragment and never written to the server.
 */
export async function computeCapabilityHash(capability: ICapability): Promise<string> {
  const canonical = canonicalCapability(capability);
  const data = new TextEncoder().encode(canonical);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return bytesToBase64Url(new Uint8Array(digest));
}

function canonicalCapability(capability: ICapability): string {
  // Sort keys lexicographically — implementation-portable canonical form.
  const ordered: Record<string, unknown> = {
    exp: capability.exp,
    nonce: capability.nonce,
    role: capability.role,
    sid: capability.sid,
    v: capability.v,
  };
  return JSON.stringify(ordered);
}
