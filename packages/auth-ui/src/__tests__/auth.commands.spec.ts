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

import type { IAuthError, IAuthService, ILoginInput, IRegisterInput, IUserAccount } from '@termlnk/auth';
import { AuthState, IAuthService as IAuthServiceId, VaultState } from '@termlnk/auth';
import { ILogService, Injector } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { LogoutCommand } from '../commands/auth.commands';

class NoopLogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: number): void {}
}

class FakeAuthService implements IAuthService {
  readonly currentUser$ = new BehaviorSubject<IUserAccount | null>(null).asObservable();
  readonly authState$ = new BehaviorSubject<AuthState>(AuthState.Unauthenticated).asObservable();
  readonly lastError$ = new BehaviorSubject<IAuthError | null>(null).asObservable();
  readonly vaultState$ = new BehaviorSubject<VaultState>(VaultState.Unlocked).asObservable();
  logoutCalls = 0;

  async register(_input: IRegisterInput): Promise<void> {}
  async login(_input: ILoginInput): Promise<void> {}
  async logout(): Promise<void> {
    this.logoutCalls++;
  }

  async listDevices() { return []; }
  async revokeDevice(_deviceId: string): Promise<void> {}
  async getAccessToken(): Promise<string | null> { return null; }
  getCurrentUser(): IUserAccount | null { return null; }
  async restore(): Promise<void> {}
  async getGoogleAuthorizeUrl(): Promise<string> { return ''; }
  async loginWithGoogle(): Promise<void> {}
  async beginGoogleWebSignIn(): Promise<{ authorizeUrl: string }> { return { authorizeUrl: '' }; }
  async pollGoogleWebSignIn(): Promise<'pending' | 'complete' | 'expired'> { return 'pending'; }
  async setupEncryptionPassword(): Promise<void> {}
  async unlockVault(): Promise<void> {}
  async changePassword(): Promise<void> {}
  async getServerCapabilities() { return { googleOAuth: false }; }
}

function createBed(opts: { withAuth: boolean }): { injector: Injector; auth: FakeAuthService | null } {
  const injector = new Injector();
  injector.add([ILogService, { useClass: NoopLogService }]);
  let auth: FakeAuthService | null = null;
  if (opts.withAuth) {
    auth = new FakeAuthService();
    injector.add([IAuthServiceId, { useValue: auth }]);
  }
  return { injector, auth };
}

describe('auth.commands', () => {
  it('LogoutCommand calls IAuthService.logout when bound', async () => {
    const bed = createBed({ withAuth: true });
    const result = await LogoutCommand.handler(bed.injector);
    expect(result).toBe(true);
    expect(bed.auth!.logoutCalls).toBe(1);
  });

  it('LogoutCommand returns false when IAuthService is unbound', async () => {
    const bed = createBed({ withAuth: false });
    const result = await LogoutCommand.handler(bed.injector);
    expect(result).toBe(false);
  });
});
