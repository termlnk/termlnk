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
import { AuthState, IAuthService, VaultState } from '@termlnk/auth';
import { ILogService, LocaleService, Quantity } from '@termlnk/core';
import { Button, cn, useDependency, useObservable } from '@termlnk/design';
import { ShieldCheckIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AccountPanel } from './AccountPanel';
import { BrandHeader } from './BrandHeader';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { VaultForm } from './VaultForm';

type ViewMode = 'login' | 'register';

// Open a URL in the OS browser via the preload-exposed shell. Typed locally to
// avoid coupling auth-ui to an Electron preload type; absent in non-Electron hosts.
function openExternalUrl(url: string): void {
  const nativeShell = (window as unknown as { nativeShell?: { openExternal: (url: string) => void } }).nativeShell;
  nativeShell?.openExternal(url);
}

export function AuthGate() {
  // OPTIONAL: cloud service may be unconfigured; fall through to a placeholder below.
  const authClient = useDependency(IAuthService, Quantity.OPTIONAL);
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
  const vaultState = useObservable<VaultState>(
    authClient?.vaultState$ ?? null,
    VaultState.Empty
  );

  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [hideErrorOnSwitch, setHideErrorOnSwitch] = useState(false);
  // Surfaces transport/route-level errors that bypass lastError$ (e.g. cloud unconfigured).
  // lastError$ wins when both are present so we never show stale text.
  const [localError, setLocalError] = useState<string | null>(null);
  // setupEncryptionPassword/unlockVault don't drive authState$, so the vault views
  // track their own in-flight flag.
  const [vaultBusy, setVaultBusy] = useState(false);
  // Only offer "Continue with Google" where the server actually mounted it; otherwise
  // the button would just open a 404 in the browser. Probed once on mount.
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    if (!authClient) {
      return;
    }
    let cancelled = false;
    void authClient.getServerCapabilities()
      .then((caps) => {
        if (!cancelled) {
          setGoogleEnabled(caps.googleOAuth);
        }
      })
      .catch((err) => {
        logService.warn('[AuthGate] capability probe failed:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [authClient, logService]);

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

  const beforeSubmit = (): void => {
    setHideErrorOnSwitch(false);
    setLocalError(null);
  };

  const reportError = (context: string, err: unknown): void => {
    logService.error(`[AuthGate] ${context} failed:`, err);
    setLocalError(err instanceof Error ? err.message : String(err));
  };

  const doLogout = async (): Promise<void> => {
    try {
      await authClient.logout();
    } catch (err) {
      logService.error('[AuthGate] logout failed:', err);
    }
  };

  if (currentUser) {
    // Identity is established; the vault may still need the encryption password
    // (OAuth accounts decouple identity from the encryption key).
    if (vaultState === VaultState.NeedsSetup || vaultState === VaultState.Locked) {
      const mode = vaultState === VaultState.NeedsSetup ? 'setup' : 'unlock';
      return (
        <div className={cn('tm:flex tm:flex-col tm:gap-6')}>
          <VaultForm
            mode={mode}
            email={currentUser.email}
            busy={vaultBusy}
            errorMessage={errorMessage}
            onSubmit={async (password: string) => {
              beforeSubmit();
              setVaultBusy(true);
              try {
                if (mode === 'setup') {
                  await authClient.setupEncryptionPassword(password);
                } else {
                  await authClient.unlockVault(password);
                }
              } catch (err) {
                reportError('vault', err);
              } finally {
                setVaultBusy(false);
              }
            }}
          />
          <p className={cn('tm:text-center tm:text-sm tm:text-grey-fg')}>
            <Button
              type="button"
              variant="link"
              disabled={vaultBusy}
              onClick={doLogout}
              className={cn('tm:h-auto tm:p-0 tm:font-medium')}
            >
              {localeService.t('auth-ui.vault.sign-out')}
            </Button>
          </p>
        </div>
      );
    }
    return (
      <AccountPanel
        user={currentUser}
        busy={busy}
        onLogout={doLogout}
      />
    );
  }

  const switchTo = (next: ViewMode): void => {
    setHideErrorOnSwitch(true);
    setLocalError(null);
    setViewMode(next);
  };

  return (
    <div className={cn('tm:flex tm:flex-col tm:gap-6')}>
      <BrandHeader
        title={localeService.t('auth-ui.welcome.title')}
        subtitle={localeService.t('auth-ui.welcome.subtitle')}
      />

      {viewMode === 'login'
        ? (
          <LoginForm
            busy={busy}
            errorMessage={errorMessage}
            onGoogleSignIn={googleEnabled
              ? async () => {
                beforeSubmit();
                try {
                  const url = await authClient.getGoogleAuthorizeUrl();
                  openExternalUrl(url);
                } catch (err) {
                  reportError('google', err);
                }
              }
              : undefined}
            onSubmit={async (input: ILoginInput) => {
              beforeSubmit();
              try {
                await authClient.login(input);
              } catch (err) {
                reportError('login', err);
              }
            }}
          />
        )
        : (
          <RegisterForm
            busy={busy}
            errorMessage={errorMessage}
            onSubmit={async (input: IRegisterInput) => {
              beforeSubmit();
              try {
                await authClient.register(input);
              } catch (err) {
                reportError('register', err);
              }
            }}
          />
        )}

      <p className={cn('tm:text-center tm:text-sm tm:text-grey-fg')}>
        {viewMode === 'login'
          ? localeService.t('auth-ui.switch.to-register-prompt')
          : localeService.t('auth-ui.switch.to-login-prompt')}
        {' '}
        <Button
          type="button"
          variant="link"
          disabled={busy}
          onClick={() => switchTo(viewMode === 'login' ? 'register' : 'login')}
          className={cn('tm:h-auto tm:p-0 tm:font-medium')}
        >
          {viewMode === 'login'
            ? localeService.t('auth-ui.switch.to-register-action')
            : localeService.t('auth-ui.switch.to-login-action')}
        </Button>
      </p>

      <div
        className={cn(`
          tm:flex tm:items-start tm:gap-2 tm:rounded-md tm:border tm:border-blue/20 tm:bg-blue/8 tm:px-3 tm:py-2
          tm:text-xs tm:text-grey-fg
        `)}
      >
        <ShieldCheckIcon className={cn('tm:mt-0.5 tm:size-3.5 tm:shrink-0 tm:text-blue')} />
        <span>{localeService.t('auth-ui.login.trust-banner')}</span>
      </div>
    </div>
  );
}
