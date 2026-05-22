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

import type { ISyncError, ISyncStats } from '@termlnk/sync';
import type { LucideIcon } from 'lucide-react';
import { IAuthService } from '@termlnk/auth';
import { ILogService, LocaleService, Quantity } from '@termlnk/core';
import { Button, cn, Switch, Tooltip, TooltipContent, TooltipTrigger, useDependency, useObservable } from '@termlnk/design';
import { ISyncService, SyncState } from '@termlnk/sync';
import {
  CloudCheckIcon,
  CloudOffIcon,
  CloudUploadIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useState } from 'react';

interface IStateVisual {
  readonly Icon: LucideIcon;
  readonly iconBgClass: string;
  readonly iconColorClass: string;
  readonly label: string;
  readonly spin?: boolean;
}

// forceFullResync stays UI-hidden — recovery-only, reachable via sync.command.force-full-resync.
export function SyncStatusPanel() {
  const syncService = useDependency(ISyncService, Quantity.OPTIONAL);
  const authService = useDependency(IAuthService, Quantity.OPTIONAL);
  const logService = useDependency(ILogService);
  const localeService = useDependency(LocaleService);

  const state = useObservable<SyncState>(
    syncService?.state$ ?? null,
    SyncState.Disabled
  );
  const stats = useObservable<ISyncStats | null>(
    syncService?.stats$ ?? null,
    null
  );
  const lastError = useObservable<ISyncError | null>(
    syncService?.lastError$ ?? null,
    null
  );
  const enabled = useObservable<boolean>(
    syncService?.enabled$ ?? null,
    false
  );

  const [busy, setBusy] = useState(false);

  if (!syncService) {
    return null;
  }

  const handleSyncNow = async (): Promise<void> => {
    setBusy(true);
    try {
      await syncService.syncNow();
    } catch (err) {
      logService.error('[SyncStatusPanel] syncNow failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleEnabled = async (next: boolean): Promise<void> => {
    setBusy(true);
    try {
      if (next) {
        await syncService.enable();
      } else {
        await syncService.disable();
      }
    } catch (err) {
      logService.error('[SyncStatusPanel] toggle enabled failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const pendingCount = stats?.pendingMutations ?? 0;
  const visual = getStateVisual(state, pendingCount, localeService);
  const lastSyncedText = stats?.lastSyncedAt
    ? formatLastSynced(stats.lastSyncedAt, localeService)
    : localeService.t('sync-ui.status.never-synced');

  return (
    <div className={cn('tm:flex tm:flex-col tm:gap-4')}>
      <div
        className={cn('tm:flex tm:items-center tm:justify-between tm:gap-4 tm:rounded-lg tm:bg-black/25 tm:px-4 tm:py-3')}
      >
        <div className={cn('tm:flex tm:min-w-0 tm:items-center tm:gap-3')}>
          <div className={cn('tm:flex tm:size-10 tm:items-center tm:justify-center tm:rounded-full', visual.iconBgClass)}>
            <visual.Icon
              className={cn('tm:size-5', visual.iconColorClass, { 'tm:animate-spin': visual.spin })}
            />
          </div>
          <div className={cn('tm:flex tm:min-w-0 tm:flex-col tm:gap-0.5')}>
            <span className={cn('tm:truncate tm:text-sm tm:font-semibold tm:text-light-grey')}>
              {visual.label}
            </span>
            <span className={cn('tm:truncate tm:text-xs tm:text-grey-fg')}>
              {lastSyncedText}
            </span>
          </div>
        </div>
        <div className={cn('tm:flex tm:items-center tm:gap-2')}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={state === SyncState.Disabled || busy}
                onClick={() => {
                  void handleSyncNow();
                }}
                aria-label={localeService.t('sync-ui.status.sync-now')}
              >
                <RefreshCwIcon
                  className={cn('tm:size-4', { 'tm:animate-spin': state === SyncState.Syncing })}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{localeService.t('sync-ui.status.sync-now')}</TooltipContent>
          </Tooltip>
          <Switch
            size="sm"
            checked={enabled}
            disabled={busy}
            onCheckedChange={(next) => {
              void handleToggleEnabled(next);
            }}
            aria-label={localeService.t('sync-ui.status.toggle-label')}
          />
        </div>
      </div>

      {pendingCount > 0 && state !== SyncState.Idle && (
        <div
          className={cn(`
            tm:flex tm:items-center tm:gap-2 tm:rounded-md tm:bg-yellow/10 tm:px-3 tm:py-2 tm:text-xs tm:text-yellow
          `)}
        >
          <CloudUploadIcon className={cn('tm:size-3.5 tm:shrink-0')} />
          <span>{localeService.t('sync-ui.status.pending', String(pendingCount))}</span>
        </div>
      )}

      {lastError && (
        <div
          role="alert"
          className={cn(`
            tm:flex tm:items-start tm:gap-2 tm:rounded-md tm:bg-red/10 tm:px-3 tm:py-2 tm:text-xs tm:text-red
          `)}
        >
          <TriangleAlertIcon className={cn('tm:mt-0.5 tm:size-3.5 tm:shrink-0')} />
          <div className={cn('tm:flex tm:min-w-0 tm:flex-1 tm:flex-col tm:gap-1')}>
            <span className={cn('tm:font-medium')}>
              {localeService.t(`sync-ui.error.${lastError.code}`)}
            </span>
            {lastError.message && lastError.message !== lastError.code && (
              <span className={cn('tm:text-grey-fg')}>{lastError.message}</span>
            )}
          </div>
          {lastError.requiresUserAction && authService && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                // Sign out so the auth flow re-prompts for password — derive() will produce
                // a fresh master key and re-wrap it into IAuthKeyValueStorage. Sync resumes
                // automatically once authState→Authenticated + masterKeyState→Unlocked.
                setBusy(true);
                void authService.logout()
                  .catch((err) => logService.error('[SyncStatusPanel] logout failed:', err))
                  .finally(() => setBusy(false));
              }}
            >
              {localeService.t('sync-ui.error.action.sign-in-again')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

const STATE_VISUALS = {
  [SyncState.Idle]: {
    Icon: CloudCheckIcon,
    iconBgClass: 'tm:bg-green/15',
    iconColorClass: 'tm:text-green',
    labelKey: 'sync-ui.state.idle',
  },
  [SyncState.Syncing]: {
    Icon: RefreshCwIcon,
    iconBgClass: 'tm:bg-blue/15',
    iconColorClass: 'tm:text-blue',
    labelKey: 'sync-ui.state.syncing',
    spin: true,
  },
  [SyncState.Offline]: {
    Icon: CloudOffIcon,
    iconBgClass: 'tm:bg-yellow/15',
    iconColorClass: 'tm:text-yellow',
    labelKey: 'sync-ui.state.offline',
  },
  [SyncState.Error]: {
    Icon: TriangleAlertIcon,
    iconBgClass: 'tm:bg-red/15',
    iconColorClass: 'tm:text-red',
    labelKey: 'sync-ui.state.error',
  },
  [SyncState.Disabled]: {
    Icon: CloudOffIcon,
    iconBgClass: 'tm:bg-grey-fg/15',
    iconColorClass: 'tm:text-grey-fg',
    labelKey: 'sync-ui.state.disabled',
  },
} satisfies Record<SyncState, Omit<IStateVisual, 'label'> & { labelKey: string }>;

function getStateVisual(state: SyncState, pendingCount: number, localeService: LocaleService): IStateVisual {
  // Idle + pending > 0 isn't really "up to date" — local outbox still holds rows the
  // server hasn't accepted. Treat it as its own visual so the green badge never lies.
  if (state === SyncState.Idle && pendingCount > 0) {
    return {
      Icon: CloudUploadIcon,
      iconBgClass: 'tm:bg-yellow/15',
      iconColorClass: 'tm:text-yellow',
      label: localeService.t('sync-ui.state.pending-push', String(pendingCount)),
    };
  }
  const { labelKey, ...rest } = STATE_VISUALS[state];
  return { ...rest, label: localeService.t(labelKey) };
}

function formatLastSynced(epochMs: number, localeService: LocaleService): string {
  const elapsedMs = Date.now() - epochMs;
  if (elapsedMs < 60_000) {
    return localeService.t('sync-ui.status.just-now');
  }
  if (elapsedMs < 3_600_000) {
    const minutes = Math.floor(elapsedMs / 60_000);
    return localeService.t('sync-ui.status.minutes-ago', String(minutes));
  }
  if (elapsedMs < 86_400_000) {
    const hours = Math.floor(elapsedMs / 3_600_000);
    return localeService.t('sync-ui.status.hours-ago', String(hours));
  }
  const days = Math.floor(elapsedMs / 86_400_000);
  return localeService.t('sync-ui.status.days-ago', String(days));
}
