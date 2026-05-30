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
import type { IDevice } from '../models/device';
import type { AuthState, IAuthCapabilities, IAuthError, VaultState } from '../models/session';
import type { ILoginInput, IRegisterInput, IUserAccount } from '../models/user';
import { createIdentifier } from '@termlnk/core';

// Auth contract — implemented on both the main process (HttpAuthService in
// @termlnk/auth-core, performs the SRP6a handshake + token storage + restore)
// and the renderer process (AuthService in @termlnk/rpc-client, forwards to
// the main-process implementation through tRPC). Main-process-only methods
// (`getAccessToken`, `getCurrentUser`, `restore`) throw on the renderer side
// because access tokens never cross the IPC boundary.
//
// Trust boundaries:
// - Plaintext password lives only inside register/login call stacks; discarded after deriving
//   the SRP verifier and master key.
// - Master key, access token and refresh token never cross the IPC boundary. Cloud RPCs are
//   authenticated by a main-process interceptor; the renderer only sees state Observables.
export interface IAuthService {
  readonly currentUser$: Observable<IUserAccount | null>;
  readonly authState$: Observable<AuthState>;
  // Last error; meaningful only while authState === Error.
  readonly lastError$: Observable<IAuthError | null>;

  // Encryption-key lifecycle, orthogonal to authState$. SRP sign-in reaches Unlocked
  // directly; OAuth sign-in lands on NeedsSetup (first time) or Locked (re-auth / new
  // device) until setupEncryptionPassword/unlockVault runs.
  readonly vaultState$: Observable<VaultState>;

  // Client derives the SRP6a verifier and uploads it; the server stores only the verifier
  // hash and never sees the password. Successful registration auto-logs in. Returns void
  // because the renderer reads the resulting user through `currentUser$`.
  register(input: IRegisterInput): Promise<void>;

  login(input: ILoginInput): Promise<void>;

  // Revokes the refresh token, clears the master key and wipes locally stored tokens.
  // Local logout completes even when the network call fails.
  logout(): Promise<void>;

  // Returns a still-valid access token, refreshing automatically when needed.
  // Returns null when both tokens have expired so the caller can drive a re-login.
  // Main-process only — the renderer must not have the raw token.
  getAccessToken(): Promise<string | null>;

  // Synchronous snapshot of the current user. Main-process only (the renderer reads
  // currentUser$ directly from its BehaviorSubject).
  getCurrentUser(): IUserAccount | null;

  // Rehydrates currentUser$/authState$ from the locally persisted user + token pair.
  // Main-process only — the renderer never persists auth state.
  restore(): Promise<void>;

  // Devices currently holding an active refresh token, ordered by lastSeenAt desc.
  // Entry for the current device has isCurrent=true.
  listDevices(): Promise<readonly IDevice[]>;

  // Revokes by refresh-token jti.
  // - Revoking the current device logs out this machine on the next 401.
  // - Revoking another device forces it to re-login on its next refresh.
  // - The server returns 204 unconditionally, so a non-existent id leaks nothing.
  revokeDevice(deviceId: string): Promise<void>;

  // Cloud authorize URL the renderer opens in the system browser. Async so the
  // renderer facade can fetch it over tRPC; the main process resolves it synchronously.
  getGoogleAuthorizeUrl(): Promise<string>;

  // Which optional sign-in methods the server advertises (e.g. Google). Lets the UI
  // gate the "Continue with Google" button. Fail-soft: returns all-false when the
  // server is unreachable or cloud is unconfigured.
  getServerCapabilities(): Promise<IAuthCapabilities>;

  // Completes a Google sign-in from the one-time relay code delivered via the
  // `termlnk://auth/callback` deep link. Main-process only — invoked by the
  // deep-link handler, not the renderer.
  loginWithGoogle(relayCode: string): Promise<void>;

  // First-time set of the encryption password (OAuth accounts have no login password
  // to derive from). Derives the master key, uploads salt + key-check value, unlocks.
  setupEncryptionPassword(password: string): Promise<void>;

  // Unlock the vault where an encryption password was already set: derive from the
  // entered password, verify against the server's key-check value, install the key.
  // Throws AuthError('wrong_encryption_password') on mismatch.
  unlockVault(password: string): Promise<void>;
}

export const IAuthService = createIdentifier<IAuthService>('auth.auth-service');
