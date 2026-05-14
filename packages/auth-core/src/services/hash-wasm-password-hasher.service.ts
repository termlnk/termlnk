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
import { argon2id } from 'hash-wasm';

// Default IPasswordHasher backend for environments with WebAssembly (Electron main/renderer,
// Node.js, browsers). React Native/Hermes overrides this through MobilePlatformPlugin since
// Hermes does not ship a WebAssembly runtime.
export class HashWasmPasswordHasher implements IPasswordHasher {
  async argon2id(password: string, salt: Uint8Array, params: IArgon2idParams): Promise<Uint8Array> {
    return await argon2id({
      password,
      salt,
      parallelism: params.parallelism,
      iterations: params.iterations,
      memorySize: params.memoryKiB,
      hashLength: params.outputBytes,
      outputType: 'binary',
    });
  }
}
