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
// derive() runs entirely client-side: email + server-issued salt -> Argon2id -> HKDF into
// auth/enc/index sub-keys. After a successful derive() the wrapped key is persisted via
// IAuthKeyValueStorage so tryRestoreFromStorage() can re-install it on the next app launch
// without asking the user for the password again. Trust model: persistence is encrypted by
// the OS keystore (Electron safeStorage: macOS Keychain / Windows DPAPI / Linux libsecret);
// an attacker with an already-unlocked device can recover the vault, but the key never
// leaves the main process and is never written in clear.
//
// lock() zeroes the in-memory key but leaves the persisted wrap intact, so restart can
// auto-recover. clearPersistedKey() must be called on explicit logout / session revocation
// to drop the wrap.
export interface IMasterKeyService {
  readonly state$: Observable<MasterKeyState>;

  // `password` is consumed transiently; callers must not retain it after this call returns.
  derive(password: string, material: IDerivationMaterial): Promise<IMasterKey>;

  lock(): void;

  // Returns null while locked.
  getCurrent(): IMasterKey | null;

  getState(): MasterKeyState;

  // Called at app start (after token/user restore). Reads the wrapped key from
  // IAuthKeyValueStorage, decrypts via the OS keystore, and installs it as the current key.
  // Returns true on success, false when no wrap exists or it is unreadable (in which case
  // a corrupt blob is removed so the next derive() starts clean).
  tryRestoreFromStorage(): Promise<boolean>;

  // Drops the persisted wrap so the next launch cannot auto-restore. Idempotent; called
  // from logout() and from token-revocation paths in HttpAuthService.
  clearPersistedKey(): Promise<void>;
}

export const IMasterKeyService = createIdentifier<IMasterKeyService>('auth.master-key-service');
