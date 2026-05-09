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

import type { IAuthClientService, IAuthError, IDevice, ILoginInput, IRegisterInput, IUserAccount } from '@termlnk/auth';
import type { Observable } from 'rxjs';
import { AuthState } from '@termlnk/auth';
import { Disposable, ILogService, Inject, toDisposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { BehaviorSubject } from 'rxjs';
import { IRPCClientService } from '../rpc-client.service';

// Renderer-side facade: mirrors IAuthService state via three tRPC subscriptions
// (currentUser$ / authState$ / lastError$) and forwards register/login/logout calls.
// A one-shot getCurrentUser query at construction time prevents a brief "logged out"
// flash before the subscription's first push lands.
//
// register/login transit the password through tRPC; once the main-process derives the
// verifier the plaintext is discarded. Master key and tokens never travel.
export class AuthClientService extends Disposable implements IAuthClientService {
  private readonly _currentUser$ = new BehaviorSubject<IUserAccount | null>(null);
  readonly currentUser$: Observable<IUserAccount | null> = this._currentUser$.asObservable();

  private readonly _authState$ = new BehaviorSubject<AuthState>(AuthState.Unauthenticated);
  readonly authState$: Observable<AuthState> = this._authState$.asObservable();

  private readonly _lastError$ = new BehaviorSubject<IAuthError | null>(null);
  readonly lastError$: Observable<IAuthError | null> = this._lastError$.asObservable();

  constructor(
    @Inject(IRPCClientService) private readonly _rpcClientService: IRPCClientService,
    @Inject(ILogService) private readonly _logService: ILogService
  ) {
    super();

    // One-shot snapshot to populate before the subscription's first push. Silent on
    // failure (cloud not configured) — the BehaviorSubject keeps its initial value.
    void this._client.getCurrentUser.query()
      .then((user) => {
        this._currentUser$.next(user ?? null);
      })
      .catch((err) => {
        this._logService.warn('[AuthClientService] initial getCurrentUser failed:', err);
      });

    const userSub = trpcSubscriptionToObservable<IUserAccount | null>(
      (opts) => this._client.currentUser$.subscribe(undefined, opts)
    ).subscribe({
      next: (user) => this._currentUser$.next(user),
      error: (err) => this._logService.warn('[AuthClientService] currentUser$ stream error:', err),
    });

    const stateSub = trpcSubscriptionToObservable<AuthState>(
      (opts) => this._client.authState$.subscribe(undefined, opts)
    ).subscribe({
      next: (state) => this._authState$.next(state),
      error: (err) => this._logService.warn('[AuthClientService] authState$ stream error:', err),
    });

    const errorSub = trpcSubscriptionToObservable<IAuthError | null>(
      (opts) => this._client.lastError$.subscribe(undefined, opts)
    ).subscribe({
      next: (e) => this._lastError$.next(e),
      error: (err) => this._logService.warn('[AuthClientService] lastError$ stream error:', err),
    });

    this.disposeWithMe(toDisposable(userSub));
    this.disposeWithMe(toDisposable(stateSub));
    this.disposeWithMe(toDisposable(errorSub));
  }

  override dispose(): void {
    this._currentUser$.complete();
    this._authState$.complete();
    this._lastError$.complete();
    super.dispose();
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
}
