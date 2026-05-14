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

import { createIdentifier } from '@termlnk/core';

// Argon2id input parameters. Field names mirror the algorithm rather than any single library
// (hash-wasm calls them iterations/memorySize, libsodium calls them opsLimit/memLimit) so the
// contract is implementation-agnostic.
//
// `parallelism` is included even though the current MASTER_KEY_DERIVATION pins it to 1, so
// future KDF versions can raise it without breaking the contract — implementations should
// reject values they cannot honour (libsodium's `crypto_pwhash` hard-codes p=1).
export interface IArgon2idParams {
  readonly memoryKiB: number;
  readonly iterations: number;
  readonly parallelism: number;
  readonly outputBytes: number;
}

// Pluggable Argon2id backend. Default implementation in `@termlnk/auth-core` uses hash-wasm
// (WebAssembly); platforms without WASM support (React Native / Hermes) override with a
// native binding such as react-native-libsodium's `crypto_pwhash`.
//
// Two implementations producing different outputs for the same (password, salt, params) is
// a contract violation — KAT vectors live in `auth-core/__tests__/kdf.spec.ts` to anchor
// cross-implementation parity.
export interface IPasswordHasher {
  argon2id(password: string, salt: Uint8Array, params: IArgon2idParams): Promise<Uint8Array>;
}

export const IPasswordHasher = createIdentifier<IPasswordHasher>('auth.password-hasher');
