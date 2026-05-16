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

import type { ITokenPair } from '../models/session';
import { createIdentifier } from '@termlnk/core';

// Token persistence abstraction. Implementations must store ciphertext on disk; the
// main-process implementation reuses ISecretCipherService (OS keystore). Tests can use a
// pure in-memory map. Tokens never cross IPC.
export interface ITokenStorageService {
  save(tokens: ITokenPair): Promise<void>;
  // Returns null when no token is stored.
  load(): Promise<ITokenPair | null>;
  clear(): Promise<void>;
}

export const ITokenStorageService = createIdentifier<ITokenStorageService>('auth.token-storage-service');
