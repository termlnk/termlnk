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

import type { IDeviceListCardHandle } from '../DeviceListCard';
import { IAuthService } from '@termlnk/auth';
import { LocaleService, Quantity } from '@termlnk/core';
import { Button, Card, CardContent, CardDescription, CardHeader, cn, useDependency } from '@termlnk/design';
import { IBackupFileService } from '@termlnk/sync';
import { BackupCard } from '@termlnk/sync-ui';
import { RefreshCwIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { DeviceListCard } from '../DeviceListCard';

export function AccountTab() {
  const localeService = useDependency(LocaleService);
  const authClient = useDependency(IAuthService, Quantity.OPTIONAL);
  const backupClient = useDependency(IBackupFileService, Quantity.OPTIONAL);

  const deviceListRef = useRef<IDeviceListCardHandle>(null);
  const [deviceLoading, setDeviceLoading] = useState(false);

  return (
    <div className="tm:flex tm:flex-col tm:gap-6">
      {authClient && (
        <Card className="tm:gap-0 tm:py-0">
          <CardHeader className="tm:border-b tm:border-line tm:bg-black/10 tm:py-3">
            <div className={cn('tm:flex tm:items-start tm:justify-between')}>
              <div>
                <h3 className="tm:text-base tm:font-semibold tm:text-white">
                  {localeService.t('settings-ui.account.section-devices')}
                </h3>
                <CardDescription className="tm:mt-2 tm:text-xs/5">
                  {localeService.t('settings-ui.account.section-devices-description')}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deviceListRef.current?.refresh()}
                disabled={deviceLoading}
                className={cn('tm:-mt-1 tm:-mr-1 tm:size-8 tm:shrink-0 tm:text-grey-fg')}
                aria-label={localeService.t('auth-ui.devices.refresh')}
              >
                <RefreshCwIcon className={cn('tm:size-3.5', { 'tm:animate-spin': deviceLoading })} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="tm:py-4">
            <DeviceListCard ref={deviceListRef} onLoadingChange={setDeviceLoading} />
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
