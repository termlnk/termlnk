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

// User account snapshot. Carries no sensitive fields and may cross IPC freely.
export interface IUserAccount {
  readonly id: string;
  readonly email: string;
  readonly displayName?: string;
  readonly avatarUrl?: string;
  readonly emailVerified: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IRegisterInput {
  email: string;
  // Used transiently inside register() only; never sent to the server, never persisted.
  password: string;
  displayName?: string;
}

export interface ILoginInput {
  email: string;
  password: string;
  // When true the encrypted refresh token is persisted so the next launch skips login.
  rememberMe?: boolean;
}
