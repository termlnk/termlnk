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
import { cn, useDependency, useObservable } from '@termlnk/design';
import { ISyncService } from '@termlnk/sync';
import { SyncStatusPanel } from '@termlnk/sync-ui';
import { AuthGate } from './AuthGate';

// Standalone account dialog body. AuthGate already switches between login/register
// (unauthenticated) and the account panel (authenticated); the sync status section is
// appended only once a user is signed in and the sync service is bound. Sections share
// one continuous surface — separated by a divider, not boxed into standalone cards.
export function AccountDialogContent() {
  const localeService = useDependency(LocaleService);
  const authClient = useDependency(IAuthService, Quantity.OPTIONAL);
  const syncService = useDependency(ISyncService, Quantity.OPTIONAL);

  const currentUser = useObservable<IUserAccount | null>(
    authClient?.currentUser$ ?? null,
    null
  );

  return (
    <div className={cn('tm:flex tm:flex-col tm:p-1')}>
      <AuthGate />

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
