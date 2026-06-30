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

import { IAuthService, VaultState } from '@termlnk/auth';
import { ILogService, LocaleService, Quantity } from '@termlnk/core';
import { Card, CardContent, CardDescription, CardHeader, cn, useDependency, useObservable } from '@termlnk/design';
import { IBackupClientService } from '@termlnk/sync';
import { BackupCard } from '@termlnk/sync-ui';
import { CheckCircle2Icon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { ChangePasswordForm } from '../ChangePasswordForm';
import { DeviceListCard } from '../DeviceListCard';

export function AccountTab() {
  const localeService = useDependency(LocaleService);
  const logService = useDependency(ILogService);
  const authClient = useDependency(IAuthService, Quantity.OPTIONAL);
  const backupClient = useDependency(IBackupClientService, Quantity.OPTIONAL);

  const vaultState = useObservable<VaultState>(
    authClient?.vaultState$ ?? null,
    VaultState.Empty
  );

  const [changeBusy, setChangeBusy] = useState(false);
  const [changeSuccess, setChangeSuccess] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);

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
      logService.error('[AccountTab] changePassword failed:', err);
      setChangeError(err instanceof Error ? err.message : String(err));
    } finally {
      setChangeBusy(false);
    }
  }, [authClient, logService]);

  const showChangePassword = authClient && vaultState === VaultState.Unlocked;

  return (
    <div className="tm:flex tm:flex-col tm:gap-6">
      {showChangePassword && (
        <Card className="tm:gap-0 tm:py-0">
          <CardHeader className="tm:border-b tm:border-line tm:bg-black/10 tm:py-3">
            <h3 className="tm:text-base tm:font-semibold tm:text-white">
              {localeService.t('auth-ui.change-password.title')}
            </h3>
            <CardDescription className="tm:mt-2 tm:text-xs/5">
              {localeService.t('auth-ui.change-password.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="tm:py-4">
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
          </CardContent>
        </Card>
      )}

      {authClient && (
        <Card className="tm:gap-0 tm:py-0">
          <CardHeader className="tm:border-b tm:border-line tm:bg-black/10 tm:py-3">
            <h3 className="tm:text-base tm:font-semibold tm:text-white">
              {localeService.t('settings-ui.account.section-devices')}
            </h3>
            <CardDescription className="tm:mt-2 tm:text-xs/5">
              {localeService.t('settings-ui.account.section-devices-description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="tm:py-4">
            <DeviceListCard />
          </CardContent>
        </Card>
      )}

      {backupClient && (
        <Card className="tm:gap-0 tm:py-0">
          <CardHeader className="tm:border-b tm:border-line tm:bg-black/10 tm:py-3">
            <h3 className="tm:text-base tm:font-semibold tm:text-white">
              {localeService.t('settings-ui.account.section-backup')}
            </h3>
            <CardDescription className="tm:mt-2 tm:text-xs/5">
              {localeService.t('settings-ui.account.section-backup-description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="tm:py-4">
            <BackupCard />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
