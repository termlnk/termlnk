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

import type { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

// OpenSSH SHA256 fingerprint of an SSH wire public key. Shared by every producer so the
// padding/prefix stay identical — mismatches surface as phantom "changed" host-key alerts.
export function sha256Fingerprint(sshWireKey: Buffer): string {
  const digest = createHash('sha256').update(sshWireKey).digest('base64').replace(/=+$/, '');
  return `SHA256:${digest}`;
}

// The SSH wire key begins with a length-prefixed algorithm name, e.g. "ssh-ed25519",
// "ssh-rsa" or "ecdsa-sha2-nistp256" — the value stored as known_host.keyType.
export function hostKeyAlgorithm(sshWireKey: Buffer): string {
  const len = sshWireKey.readUInt32BE(0);
  return sshWireKey.subarray(4, 4 + len).toString('ascii');
}
