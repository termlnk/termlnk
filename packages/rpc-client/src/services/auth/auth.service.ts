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

import type { GoogleWebSignInStatus, IAuthCapabilities, IAuthError, IAuthService, IDevice, IGoogleWebSignInBegin, ILoginInput, IRegisterInput, IUserAccount } from '@termlnk/auth';
import type { Observable } from 'rxjs';
import { AuthState, VaultState } from '@termlnk/auth';
import { Disposable, ILogService, toDisposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { BehaviorSubject } from 'rxjs';
import { IRPCClientService } from '../rpc-client.service';

const MAIN_PROCESS_ONLY_MESSAGE = '[AuthService] this method is only available in the main process';

// Renderer-side implementation of IAuthService. Mirrors the main-process state
// via three tRPC subscriptions and forwards mutations. Methods that hold
// privileged material (access token, persisted user) intentionally throw — the
// renderer must never observe them across IPC.
export class AuthService extends Disposable implements IAuthService {
  private readonly _currentUser$ = new BehaviorSubject<IUserAccount | null>(null);
  readonly currentUser$: Observable<IUserAccount | null> = this._currentUser$.asObservable();

  // Mirror the main process's Restoring default until the subscription delivers its first
  // push, so the renderer doesn't momentarily report signed-out during cold start.
  private readonly _authState$ = new BehaviorSubject<AuthState>(AuthState.Restoring);
  readonly authState$: Observable<AuthState> = this._authState$.asObservable();

  private readonly _lastError$ = new BehaviorSubject<IAuthError | null>(null);
  readonly lastError$: Observable<IAuthError | null> = this._lastError$.asObservable();

  private readonly _vaultState$ = new BehaviorSubject<VaultState>(VaultState.Empty);
  readonly vaultState$: Observable<VaultState> = this._vaultState$.asObservable();

  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    // One-shot snapshot so we don't flash a "logged out" UI before the subscription's first push.
    // Silent on failure (cloud not configured) — the BehaviorSubject keeps its initial value.
    void this._client.getCurrentUser.query()
      .then((user) => {
        this._currentUser$.next(user ?? null);
      })
      .catch((err) => {
        this._logService.warn('[AuthService] initial getCurrentUser failed:', err);
      });

    const userSub = trpcSubscriptionToObservable<IUserAccount | null>(
      (opts) => this._client.currentUser$.subscribe(undefined, opts)
    ).subscribe({
      next: (user) => this._currentUser$.next(user),
      error: (err) => this._logService.warn('[AuthService] currentUser$ stream error:', err),
    });

    const stateSub = trpcSubscriptionToObservable<AuthState>(
      (opts) => this._client.authState$.subscribe(undefined, opts)
    ).subscribe({
      next: (state) => this._authState$.next(state),
      error: (err) => this._logService.warn('[AuthService] authState$ stream error:', err),
    });

    const errorSub = trpcSubscriptionToObservable<IAuthError | null>(
      (opts) => this._client.lastError$.subscribe(undefined, opts)
    ).subscribe({
      next: (e) => this._lastError$.next(e),
      error: (err) => this._logService.warn('[AuthService] lastError$ stream error:', err),
    });

    const vaultSub = trpcSubscriptionToObservable<VaultState>(
      (opts) => this._client.vaultState$.subscribe(undefined, opts)
    ).subscribe({
      next: (state) => this._vaultState$.next(state),
      error: (err) => this._logService.warn('[AuthService] vaultState$ stream error:', err),
    });

    this.disposeWithMe(toDisposable(userSub));
    this.disposeWithMe(toDisposable(stateSub));
    this.disposeWithMe(toDisposable(errorSub));
    this.disposeWithMe(toDisposable(vaultSub));
  }

  override dispose(): void {
    super.dispose();
    this._currentUser$.complete();
    this._authState$.complete();
    this._lastError$.complete();
    this._vaultState$.complete();
  }

  private get _client() {
    return this._rpcClientService.getClient().auth;
  }

  async register(input: IRegisterInput): Promise<void> {
    await this._client.register.mutate(input);
  }

  async login(input: ILoginInput): Promise<void> {
    await this._client.login.mutate(input);
  }

  async logout(): Promise<void> {
    await this._client.logout.mutate();
  }

  async listDevices(): Promise<readonly IDevice[]> {
    return this._client.listDevices.query();
  }

  async revokeDevice(deviceId: string): Promise<void> {
    await this._client.revokeDevice.mutate({ deviceId });
  }

  async getGoogleAuthorizeUrl(): Promise<string> {
    return this._client.getGoogleAuthorizeUrl.query();
  }

  async getServerCapabilities(): Promise<IAuthCapabilities> {
    return this._client.getServerCapabilities.query();
  }

  async setupEncryptionPassword(password: string): Promise<void> {
    await this._client.setupEncryptionPassword.mutate({ password });
  }

  async unlockVault(password: string): Promise<void> {
    await this._client.unlockVault.mutate({ password });
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await this._client.changePassword.mutate({ oldPassword, newPassword });
  }

  // Driven by the main-process deep-link handler; the renderer never invokes it.
  // The web shell uses begin/pollGoogleWebSignIn instead (relay code is claimed
  // server-side), so this stays main-process-only.
  loginWithGoogle(): Promise<void> {
    throw new Error(MAIN_PROCESS_ONLY_MESSAGE);
  }

  async beginGoogleWebSignIn(): Promise<IGoogleWebSignInBegin> {
    return this._client.beginGoogleWebSignIn.mutate();
  }

  async pollGoogleWebSignIn(): Promise<GoogleWebSignInStatus> {
    return this._client.pollGoogleWebSignIn.mutate() as Promise<GoogleWebSignInStatus>;
  }

  // Renderer-side synchronous getter reads the locally mirrored BehaviorSubject; the
  // value tracks the main-process currentUser$ stream within one round-trip.
  getCurrentUser(): IUserAccount | null {
    return this._currentUser$.getValue();
  }

  // Access token is privileged and never crosses IPC.
  getAccessToken(): Promise<string | null> {
    throw new Error(MAIN_PROCESS_ONLY_MESSAGE);
  }

  // Persisted-state rehydration is the main process's responsibility.
  restore(): Promise<void> {
    throw new Error(MAIN_PROCESS_ONLY_MESSAGE);
  }

  // Driven by the main-process auth/sync bridge on Authenticated+Unlocked transitions;
  // the journal it replays never leaves the main process.
  resumePendingPasswordChange(): Promise<void> {
    throw new Error(MAIN_PROCESS_ONLY_MESSAGE);
  }
}
