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

import { IAuthService } from '@termlnk/auth';
import { LocaleService, Quantity } from '@termlnk/core';
import { Card, CardContent, CardDescription, CardHeader, useDependency } from '@termlnk/design';
import { IBackupClientService } from '@termlnk/sync';
import { BackupCard } from '@termlnk/sync-ui';
import { DeviceListCard } from '../DeviceListCard';

// Devices tab: composes sync-ui's DeviceListCard / BackupCard. Cloud sync controls live in
// the account dialog (AccountDialogContent), reachable from the sidebar user button. Login
// and registration also live in that dialog. Each section appears only when its underlying
// service is bound.
export function AccountTab() {
  const localeService = useDependency(LocaleService);
  const authClient = useDependency(IAuthService, Quantity.OPTIONAL);
  const backupClient = useDependency(IBackupClientService, Quantity.OPTIONAL);

  return (
    <div className="tm:flex tm:flex-col tm:gap-6">
      {authClient && (
        <Card className="tm:gap-0 tm:bg-one-bg/65 tm:py-0">
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
        <Card className="tm:gap-0 tm:bg-one-bg/65 tm:py-0">
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
