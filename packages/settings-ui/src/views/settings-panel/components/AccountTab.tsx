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

import { IAuthClientService } from '@termlnk/auth';
import { AuthGate, DeviceListCard } from '@termlnk/auth-ui';
import { LocaleService, Quantity } from '@termlnk/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn, useDependency } from '@termlnk/design';
import { IBackupClientService, ISyncService } from '@termlnk/sync';
import { BackupCard, SyncStatusPanel } from '@termlnk/sync-ui';

// Account & Sync tab: composes auth-ui's AuthGate with sync-ui's SyncStatusPanel /
// BackupCard / DeviceListCard. Each section appears only when its underlying service is
// bound, so an unconfigured cloud build collapses to just the AuthGate placeholder.
export function AccountTab() {
  const localeService = useDependency(LocaleService);
  const authClient = useDependency(IAuthClientService, Quantity.OPTIONAL);
  const syncService = useDependency(ISyncService, Quantity.OPTIONAL);
  const backupClient = useDependency(IBackupClientService, Quantity.OPTIONAL);

  return (
    <div className={cn('tm:flex tm:flex-col tm:gap-4')}>
      <Card>
        <CardHeader>
          <CardTitle className={cn('tm:text-sm')}>
            {localeService.t('settings-ui.account.section-account')}
          </CardTitle>
          <CardDescription className={cn('tm:text-xs')}>
            {localeService.t('settings-ui.account.section-account-description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthGate />
        </CardContent>
      </Card>

      {syncService && authClient && (
        <Card>
          <CardHeader>
            <CardTitle className={cn('tm:text-sm')}>
              {localeService.t('settings-ui.account.section-sync')}
            </CardTitle>
            <CardDescription className={cn('tm:text-xs')}>
              {localeService.t('settings-ui.account.section-sync-description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SyncStatusPanel />
          </CardContent>
        </Card>
      )}

      {authClient && (
        <Card>
          <CardHeader>
            <CardTitle className={cn('tm:text-sm')}>
              {localeService.t('settings-ui.account.section-devices')}
            </CardTitle>
            <CardDescription className={cn('tm:text-xs')}>
              {localeService.t('settings-ui.account.section-devices-description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeviceListCard />
          </CardContent>
        </Card>
      )}

      {backupClient && (
        <Card>
          <CardHeader>
            <CardTitle className={cn('tm:text-sm')}>
              {localeService.t('settings-ui.account.section-backup')}
            </CardTitle>
            <CardDescription className={cn('tm:text-xs')}>
              {localeService.t('settings-ui.account.section-backup-description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BackupCard />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
