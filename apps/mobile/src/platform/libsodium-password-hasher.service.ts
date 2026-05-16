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

import type { IArgon2idParams, IPasswordHasher } from '@termlnk/auth';
import { ILogService, Inject } from '@termlnk/core';
import { crypto_pwhash, crypto_pwhash_ALG_ARGON2ID13, crypto_pwhash_SALTBYTES, ready } from 'react-native-libsodium';

// React Native IPasswordHasher backend. React Native/Hermes has no WebAssembly runtime, so
// the default hash-wasm implementation in @termlnk/auth-core cannot run here. libsodium's
// `crypto_pwhash` provides a JSI-backed Argon2id and is also the same C reference used by
// Standard Notes and Proton Pass on mobile.
//
// Cross-platform parity invariants:
// - salt MUST be exactly 16 bytes (libsodium's hard-coded crypto_pwhash_SALTBYTES). The
//   shared `computeArgon2Salt` already produces 16-byte HKDF output for this reason.
// - parallelism MUST be 1. libsodium does not expose a `p` parameter — the C call site
//   hard-codes it (jedisct1 has refused to surface it across issues #986/#1092/PR #1221).
//   Bumping `MASTER_KEY_DERIVATION.parallelism` would silently desync this backend from
//   the hash-wasm one, so we assert instead of papering over it.
export class LibsodiumPasswordHasher implements IPasswordHasher {
  // Field declaration is separated from the constructor parameter because
  // babel-plugin-parameter-decorator cannot pair a parameter decorator with a TypeScript
  // parameter property — see apps/mobile/babel.config.js.
  private readonly _logService: ILogService;

  constructor(
    @Inject(ILogService) logService: ILogService
  ) {
    this._logService = logService;
  }

  async argon2id(password: string, salt: Uint8Array, params: IArgon2idParams): Promise<Uint8Array> {
    if (salt.length !== crypto_pwhash_SALTBYTES) {
      throw new Error(
        `[LibsodiumPasswordHasher] salt must be ${crypto_pwhash_SALTBYTES} bytes (got ${salt.length})`
      );
    }
    if (params.parallelism !== 1) {
      throw new Error(
        `[LibsodiumPasswordHasher] parallelism must be 1 (libsodium constraint); got ${params.parallelism}`
      );
    }

    await ready;
    try {
      return crypto_pwhash(
        params.outputBytes,
        password,
        salt,
        params.iterations,
        params.memoryKiB * 1024,
        crypto_pwhash_ALG_ARGON2ID13
      );
    } catch (err) {
      this._logService.error('[LibsodiumPasswordHasher] argon2id failed', err);
      throw err;
    }
  }
}
