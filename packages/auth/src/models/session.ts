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

export enum AuthState {
  Unauthenticated = 'unauthenticated',
  Authenticating = 'authenticating',
  Authenticated = 'authenticated',
  Error = 'error',
}

// Held by the main process only; never crosses IPC.
export interface ITokenPair {
  // Short-lived bearer for cloud RPCs (typically 15 minutes).
  accessToken: string;
  // Long-lived (typically 30 days) used to mint new access tokens.
  refreshToken: string;
  // Both expirations are ms-since-epoch.
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
}

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_already_registered'
  | 'email_not_verified'
  | 'rate_limited'
  | 'network'
  | 'server_error'
  | 'token_expired'
  | 'unknown';

export interface IAuthError {
  code: AuthErrorCode;
  message: string;
}
