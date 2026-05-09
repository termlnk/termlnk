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

export enum MasterKeyState {
  Locked = 'locked',
  Unlocked = 'unlocked',
}

// Derived client-side from the master password + email salt via Argon2id, then split by
// HKDF into three sub-keys. Lives in main-process memory only — never persisted, never
// crossed across IPC, gone on process exit.
//
// - authKey  — input to the SRP6a verifier / JWT auth hash. Server-only verification path;
//              compromise does not yield encKey.
// - encKey   — XChaCha20-Poly1305 key for sync payloads and backup archives.
// - indexKey — HMAC-SHA256 key producing irreversible-but-indexable field hashes so the
//              cloud can look up rows without seeing plaintext.
export interface IMasterKey {
  readonly authKey: Uint8Array;
  readonly encKey: Uint8Array;
  readonly indexKey: Uint8Array;
  // Email is the stable component of the salt; also distinguishes accounts in multi-user setups.
  readonly email: string;
}

// Argon2id derivation material. The salt is generated client-side at register time, uploaded
// to the server, and replayed on every subsequent login so re-derivation is deterministic.
export interface IDerivationMaterial {
  email: string;
  saltB64: string;
}
