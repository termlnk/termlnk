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

import type { IAuthError, ILoginInput, IRegisterInput, IUserAccount } from '@termlnk/auth';
import { AuthState, IAuthClientService } from '@termlnk/auth';
import { ILogService, LocaleService, Quantity } from '@termlnk/core';
import { cn, useDependency, useObservable } from '@termlnk/design';
import { useState } from 'react';
import { AccountPanel } from './AccountPanel';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

type ViewMode = 'login' | 'register';

export function AuthGate() {
  // OPTIONAL: cloud service may be unconfigured; fall through to a placeholder below.
  const authClient = useDependency(IAuthClientService, Quantity.OPTIONAL);
  const logService = useDependency(ILogService);
  const localeService = useDependency(LocaleService);

  const currentUser = useObservable<IUserAccount | null>(
    authClient?.currentUser$ ?? null,
    null
  );
  const authState = useObservable<AuthState>(
    authClient?.authState$ ?? null,
    AuthState.Unauthenticated
  );
  const lastError = useObservable<IAuthError | null>(
    authClient?.lastError$ ?? null,
    null
  );

  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [hideErrorOnSwitch, setHideErrorOnSwitch] = useState(false);
  // Surfaces transport/route-level errors that bypass lastError$ (e.g. cloud unconfigured).
  // lastError$ wins when both are present so we never show stale text.
  const [localError, setLocalError] = useState<string | null>(null);

  if (!authClient) {
    return (
      <div
        role="status"
        className={cn('tm:flex tm:flex-col tm:gap-2 tm:text-sm tm:text-grey-fg')}
      >
        <div className={cn('tm:font-medium tm:text-light-grey')}>
          {localeService.t('auth-ui.gate.unavailable-title')}
        </div>
        <div>{localeService.t('auth-ui.gate.unavailable-detail')}</div>
      </div>
    );
  }

  const busy = authState === AuthState.Authenticating;
  const errorMessage = hideErrorOnSwitch
    ? undefined
    : (lastError?.message ?? localError ?? undefined);

  if (currentUser) {
    return (
      <AccountPanel
        user={currentUser}
        busy={busy}
        onLogout={async () => {
          try {
            await authClient.logout();
          } catch (err) {
            logService.error('[AuthGate] logout failed:', err);
          }
        }}
      />
    );
  }

  const switchTo = (next: ViewMode): void => {
    setHideErrorOnSwitch(true);
    setLocalError(null);
    setViewMode(next);
  };

  const beforeSubmit = (): void => {
    setHideErrorOnSwitch(false);
    setLocalError(null);
  };

  const handleSubmitError = (context: 'login' | 'register', err: unknown): void => {
    logService.error(`[AuthGate] ${context} failed:`, err);
    const message = err instanceof Error ? err.message : String(err);
    setLocalError(message);
  };

  if (viewMode === 'register') {
    return (
      <RegisterForm
        busy={busy}
        errorMessage={errorMessage}
        onSwitchToLogin={() => switchTo('login')}
        onSubmit={async (input: IRegisterInput) => {
          beforeSubmit();
          try {
            await authClient.register(input);
          } catch (err) {
            handleSubmitError('register', err);
          }
        }}
      />
    );
  }

  return (
    <LoginForm
      busy={busy}
      errorMessage={errorMessage}
      onSwitchToRegister={() => switchTo('register')}
      onSubmit={async (input: ILoginInput) => {
        beforeSubmit();
        try {
          await authClient.login(input);
        } catch (err) {
          handleSubmitError('login', err);
        }
      }}
    />
  );
}
