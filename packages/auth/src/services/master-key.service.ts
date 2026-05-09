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

import type { Observable } from 'rxjs';
import type { IDerivationMaterial, IMasterKey, MasterKeyState } from '../models/master-key';
import { createIdentifier } from '@termlnk/core';

// Master key derivation and lifecycle. Main-process only.
//
// The key never persists; users re-derive it on every login. lock() zeroes the in-memory key
// (called on explicit logout or after long inactivity). Derivation runs entirely client-side:
// email + server-issued salt -> Argon2id -> HKDF into auth/enc/index sub-keys.
//
// Consumers: SyncCryptoService (encKey for payload encryption), AuthService (authKey for SRP6a
// verifier / JWT auth hash), backup export/import (encKey for archive encryption).
export interface IMasterKeyService {
  readonly state$: Observable<MasterKeyState>;

  // `password` is consumed transiently; callers must not retain it after this call returns.
  derive(password: string, material: IDerivationMaterial): Promise<IMasterKey>;

  lock(): void;

  // Returns null while locked.
  getCurrent(): IMasterKey | null;

  getState(): MasterKeyState;
}

export const IMasterKeyService = createIdentifier<IMasterKeyService>('auth.master-key-service');
