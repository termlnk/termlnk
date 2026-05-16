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

import type { IUserAccount } from '../models/user';
import { createIdentifier } from '@termlnk/core';

// User-account persistence abstraction. Mirrors ITokenStorageService: the implementation
// stores the full IUserAccount as a single JSON blob under IAuthKeyValueStorage so the
// host platform's encryption (OS keystore on desktop/web, Keychain/Keystore on mobile)
// applies transparently. Splitting it from token storage keeps single responsibility —
// fail-soft clear of tokens does not depend on knowing user state, and vice versa.
export interface IUserStorageService {
  save(user: IUserAccount): Promise<void>;
  // Returns null when no user is stored.
  load(): Promise<IUserAccount | null>;
  clear(): Promise<void>;
}

export const IUserStorageService = createIdentifier<IUserStorageService>('auth.user-storage-service');
