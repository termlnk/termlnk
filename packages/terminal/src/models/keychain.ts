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

export type SshKeyAlgorithm = 'ed25519' | 'ecdsa' | 'rsa';

/** Symmetric cipher protecting a passphrase-encrypted private key. */
export type SshKeyCipher = 'aes256-ctr' | 'aes128-ctr' | '3des-cbc';

export type SshKeySource = 'generated' | 'imported';

export interface ISshKey {
  id: string;
  label: string;
  algorithm: SshKeyAlgorithm;
  /** rsa: 2048/4096; ecdsa: 256/384/521; ed25519: undefined. */
  bits?: number;
  /** OpenSSH private key (encrypted at rest). */
  privateKey: string;
  /** OpenSSH public key line: "ssh-ed25519 AAAA... comment". */
  publicKey: string;
  /** Optional SSH certificate; public material, stored in plaintext. */
  certificate?: string;
  /** Encrypted at rest; present only when savePassphrase is true. */
  passphrase?: string;
  savePassphrase: boolean;
  source: SshKeySource;
  /** SHA256:... fingerprint of the public key, for display. */
  publicKeyFingerprint?: string;
}

export interface IIdentity {
  id: string;
  label: string;
  username: string;
  /** Encrypted at rest. */
  password?: string;
  /** Reference to ISshKey.id. */
  keyId?: string;
}

export interface ISshKeyChangeEvent {
  type: 'add' | 'update' | 'delete';
  id: string;
}

export interface IIdentityChangeEvent {
  type: 'add' | 'update' | 'delete';
  id: string;
}

// Renderer-facing projections: the private key and passphrase never cross the process
// boundary, surfaced only as the hasPassphrase flag.
export interface IPublicSshKey {
  id: string;
  label: string;
  algorithm: SshKeyAlgorithm;
  bits: number | null;
  publicKey: string;
  certificate: string | null;
  savePassphrase: boolean;
  source: SshKeySource;
  publicKeyFingerprint: string | null;
  hasPassphrase: boolean;
}

export interface IPublicIdentity {
  id: string;
  label: string;
  username: string;
  keyId: string | null;
  hasPassword: boolean;
}
