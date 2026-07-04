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

import type { IUserAccount } from '@termlnk/auth';
import { IAuthService } from '@termlnk/auth';
import { ILogService, LocaleService, Quantity } from '@termlnk/core';
import { Button, cn, useDependency, useObservable } from '@termlnk/design';
import { ISyncService } from '@termlnk/sync';
import { SyncStatusPanel } from '@termlnk/sync-ui';
import { ArrowLeftIcon, CheckCircle2Icon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { AuthGate } from './AuthGate';
import { ChangePasswordForm } from './ChangePasswordForm';

type DialogView = 'main' | 'change-password';

export function AccountDialogContent() {
  const localeService = useDependency(LocaleService);
  const logService = useDependency(ILogService);
  const authClient = useDependency(IAuthService, Quantity.OPTIONAL);
  const syncService = useDependency(ISyncService, Quantity.OPTIONAL);

  const currentUser = useObservable<IUserAccount | null>(
    authClient?.currentUser$ ?? null,
    null
  );

  const [view, setView] = useState<DialogView>('main');
  const [changeBusy, setChangeBusy] = useState(false);
  const [changeSuccess, setChangeSuccess] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);

  const handleBack = useCallback(() => {
    setView('main');
    setChangeSuccess(false);
    setChangeError(null);
  }, []);

  const handleChangePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    if (!authClient) {
      return;
    }
    setChangeBusy(true);
    setChangeError(null);
    setChangeSuccess(false);
    try {
      await authClient.changePassword(oldPassword, newPassword);
      setChangeSuccess(true);
    } catch (err) {
      logService.error('[AccountDialogContent] changePassword failed:', err);
      setChangeError(err instanceof Error ? err.message : String(err));
    } finally {
      setChangeBusy(false);
    }
  }, [authClient, logService]);

  if (view === 'change-password' && currentUser) {
    return (
      <div className={cn('tm:flex tm:flex-col tm:gap-4 tm:p-1')}>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          disabled={changeBusy}
          className={cn(`
            tm:-ml-1 tm:w-fit tm:gap-1.5 tm:text-grey-fg
            tm:hover:text-light-grey
          `)}
        >
          <ArrowLeftIcon className={cn('tm:size-4')} />
          {localeService.t('auth-ui.account-dialog.back')}
        </Button>

        {changeSuccess
          ? (
            <div className={cn('tm:flex tm:items-center tm:gap-2 tm:text-sm tm:text-green')}>
              <CheckCircle2Icon className={cn('tm:size-4 tm:shrink-0')} />
              {localeService.t('auth-ui.change-password.success')}
            </div>
          )
          : (
            <ChangePasswordForm
              busy={changeBusy}
              errorMessage={changeError ?? undefined}
              onSubmit={handleChangePassword}
            />
          )}
      </div>
    );
  }

  return (
    <div className={cn('tm:flex tm:flex-col tm:p-1')}>
      <AuthGate onChangePassword={() => setView('change-password')} />

      {currentUser && syncService && (
        <section className={cn('tm:mt-6 tm:flex tm:flex-col tm:gap-4 tm:border-t tm:border-line tm:pt-6')}>
          <div className={cn('tm:flex tm:flex-col tm:gap-1.5')}>
            <h3 className={cn('tm:text-base tm:font-semibold tm:text-white')}>
              {localeService.t('auth-ui.account-dialog.sync-title')}
            </h3>
            <p className={cn('tm:text-xs/5 tm:text-grey-fg')}>
              {localeService.t('auth-ui.account-dialog.sync-description')}
            </p>
          </div>
          <SyncStatusPanel />
        </section>
      )}
    </div>
  );
}
