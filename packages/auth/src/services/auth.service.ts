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
import type { AuthState, IAuthError } from '../models/session';
import type { ILoginInput, IRegisterInput, IUserAccount } from '../models/user';
import { createIdentifier } from '@termlnk/core';

// Main-process auth service.
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

  // Client derives the SRP6a verifier and uploads it; the server stores only the verifier
  // hash and never sees the password. Successful registration auto-logs in.
  register(input: IRegisterInput): Promise<IUserAccount>;

  login(input: ILoginInput): Promise<IUserAccount>;

  // Revokes the refresh token, clears the master key and wipes locally stored tokens.
  // Local logout completes even when the network call fails.
  logout(): Promise<void>;

  // Returns a still-valid access token, refreshing automatically when needed.
  // Returns null when both tokens have expired so the caller can drive a re-login.
  getAccessToken(): Promise<string | null>;

  getCurrentUser(): IUserAccount | null;

  // Rehydrates currentUser$/authState$ from the locally persisted user + token pair.
  // - Cached user present → emit it immediately so the UI does not flash the login screen.
  // - Token still valid (or refreshable) → best-effort GET /auth/me to refresh stale fields;
  //   network/404 failures keep the cached user (graceful degrade); 401/403 clears the
  //   whole session.
  // - Token missing or refresh chain broken → clear the cached user and emit Unauthenticated.
  //
  // Idempotent and safe to call multiple times; only the main-process plugin's onReady
  // invokes it in production. A noop when the user was never logged in.
  restore(): Promise<void>;

  // Devices currently holding an active refresh token, ordered by lastSeenAt desc.
  // Entry for the current device has isCurrent=true.
  listDevices(): Promise<readonly IDevice[]>;

  // Revokes by refresh-token jti.
  // - Revoking the current device logs out this machine on the next 401.
  // - Revoking another device forces it to re-login on its next refresh.
  // - The server returns 204 unconditionally, so a non-existent id leaks nothing.
  revokeDevice(deviceId: string): Promise<void>;
}

export const IAuthService = createIdentifier<IAuthService>('auth.auth-service');
