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
  // Startup default: a persisted session is being rehydrated (token refresh + /auth/me).
  // We do not yet know whether the user is signed in, so auth-gated UIs must show a
  // loading state rather than treating this as signed-out — otherwise a valid session
  // flashes the login screen on every cold start before restore() resolves.
  Restoring = 'restoring',
  Unauthenticated = 'unauthenticated',
  Authenticating = 'authenticating',
  Authenticated = 'authenticated',
  Error = 'error',
}

// Encryption-key (vault) lifecycle, orthogonal to AuthState. Identity (who you are)
// and the vault (the master key encrypting synced data) are decoupled: an OAuth
// account is Authenticated immediately but its vault stays Locked/NeedsSetup until
// the user supplies the encryption password. SRP accounts derive the key from the
// login password, so they reach Unlocked at sign-in.
export enum VaultState {
  // No vault context — logged out, or cloud not configured.
  Empty = 'empty',
  // Authenticated, an encryption password was set before, but the key is not in
  // memory here (new device or post-restart) — the user must enter it to unlock.
  Locked = 'locked',
  // Authenticated but no encryption password has ever been set (first OAuth sign-in).
  NeedsSetup = 'needs_setup',
  // encKey/indexKey are in memory; sync encryption is available.
  Unlocked = 'unlocked',
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
  | 'wrong_encryption_password' // vault unlock: entered password does not match the stored key-check value
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

// Which optional sign-in methods the configured cloud server actually mounted.
// Lets the UI hide a "Continue with Google" button on a server without Google OAuth.
export interface IAuthCapabilities {
  googleOAuth: boolean;
}
