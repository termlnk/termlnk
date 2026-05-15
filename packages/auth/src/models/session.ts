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
  | 'registration_closed' // server has open registration disabled
  | 'session_expired' // refresh token revoked / replayed — must sign in again
  | 'invalid_request' // server-side validation rejected the request (zod)
  | 'rate_limited'
  | 'network'
  | 'server_error'
  | 'token_expired' // access token expired but refresh may still succeed
  | 'unknown';

export interface IAuthError {
  code: AuthErrorCode;
  message: string;
}

// Error class thrown by IAuthService implementations. `message` is a user-facing
// string suitable for direct rendering; `code` is the machine-readable classifier
// for callers that want to localize or branch on the failure reason.
export class AuthError extends Error implements IAuthError {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}
