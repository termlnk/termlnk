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

// In-memory access/refresh-token cache with proactive renewal. Other main-process
// services (sync-core, shared-terminal-core) inject this to attach Authorization
// headers without duplicating refresh logic. The HTTP implementation lives in
// @termlnk/auth-core; tests inject a fake.
//
// Fail-soft semantics: when refresh fails, getAccessToken returns null so the
// caller can render a degraded state and the UI drives re-login instead of an
// inline RPC throw.
export interface ITokenManager {
  getAccessToken(): Promise<string | null>;
  setTokens(tokens: ITokenPair): Promise<void>;
  clear(): Promise<void>;
  peekCached(): ITokenPair | null;
}

export const ITokenManager = createIdentifier<ITokenManager>('auth.token-manager');
