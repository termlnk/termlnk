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
import { LocaleService, Quantity } from '@termlnk/core';
import { Card, CardContent, CardDescription, CardHeader, cn, useDependency, useObservable } from '@termlnk/design';
import { ISyncService } from '@termlnk/sync';
import { SyncStatusPanel } from '@termlnk/sync-ui';
import { AuthGate } from './AuthGate';

// Standalone account dialog body. AuthGate already switches between login/register
// (unauthenticated) and the account panel (authenticated); the sync status section is
// appended only once a user is signed in and the sync service is bound.
export function AccountDialogContent() {
  const localeService = useDependency(LocaleService);
  const authClient = useDependency(IAuthService, Quantity.OPTIONAL);
  const syncService = useDependency(ISyncService, Quantity.OPTIONAL);

  const currentUser = useObservable<IUserAccount | null>(
    authClient?.currentUser$ ?? null,
    null
  );

  return (
    <div className={cn('tm:flex tm:flex-col tm:gap-6 tm:p-1')}>
      <AuthGate />

      {currentUser && syncService && (
        <Card className="tm:gap-0 tm:bg-one-bg/65 tm:py-0">
          <CardHeader className="tm:border-b tm:border-line tm:bg-black/10 tm:py-3">
            <h3 className="tm:text-base tm:font-semibold tm:text-white">
              {localeService.t('auth-ui.account-dialog.sync-title')}
            </h3>
            <CardDescription className="tm:mt-2 tm:text-xs/5">
              {localeService.t('auth-ui.account-dialog.sync-description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="tm:py-4">
            <SyncStatusPanel />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
