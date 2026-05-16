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

// Decouples the cloud /auth/refresh transport from the in-memory cache and refresh
// scheduling. The HTTP implementation lives in @termlnk/auth-core; tests can inject a fake.
//
// Failure semantics:
// - Refresh-token expired -> throw; caller wipes local state and triggers re-login.
// - Network / server error -> throw; caller decides to retry or give up.
// - Implementations must be idempotent: calling refresh twice with the same token must
//   either return the same state or fail consistently.
export interface ITokenRefresher {
  refresh(refreshToken: string): Promise<ITokenPair>;
}

export const ITokenRefresher = createIdentifier<ITokenRefresher>('auth.token-refresher');
