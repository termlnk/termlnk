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

// Argon2id input parameters. Field names mirror the algorithm so the contract is
// implementation-agnostic. Implementations should reject values they cannot honour
// (some bindings hard-code parallelism=1).
export interface IArgon2idParams {
  readonly memoryKiB: number;
  readonly iterations: number;
  readonly parallelism: number;
  readonly outputBytes: number;
}

// Pluggable Argon2id backend. Two implementations producing different outputs for the
// same (password, salt, params) is a contract violation.
export interface IPasswordHasher {
  argon2id(password: string, salt: Uint8Array, params: IArgon2idParams): Promise<Uint8Array>;
}

export const IPasswordHasher = createIdentifier<IPasswordHasher>('auth.password-hasher');
