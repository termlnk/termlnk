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
import type { ReactElement } from 'react';
import { ILogService, LocaleService, Quantity } from '@termlnk/core';
import { Badge, Button, cn, Switch, useDependency, useObservable } from '@termlnk/design';
import { ISyncService, SyncState } from '@termlnk/sync';
import { CloudCheckIcon, CloudOffIcon, RefreshCwIcon, RotateCcwIcon, TriangleAlertIcon } from 'lucide-react';
import { useState } from 'react';

/**
 * 同步状态面板——订阅 ISyncService 的 state$/stats$/lastError$ 渲染。
 *
 * 优雅降级：
 * - ISyncService 未注册（云服务未配置）→ 不渲染（返回 null）。SettingsTab 等
 *   消费方应该自己提供"云服务未配置"占位文案，而不是把降级状态混进同步组件
 *
 * 触发动作：
 * - syncNow：立即 push + pull
 * - forceFullResync：清 cursor 后 pull（用户怀疑本地数据落后或损坏时）
 *
 * 这两个按钮在 state === Disabled 时禁用——sync 未启用，触发也无意义。
 */
export function SyncStatusPanel() {
  const syncService = useDependency(ISyncService, Quantity.OPTIONAL);
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

  const handleForceFullResync = async (): Promise<void> => {
    setBusy(true);
    try {
      await syncService.forceFullResync();
    } catch (err) {
      logService.error('[SyncStatusPanel] forceFullResync failed:', err);
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

  const stateBadge = renderStateBadge(state, localeService);
  const lastSyncedText = stats?.lastSyncedAt
    ? formatLastSynced(stats.lastSyncedAt, localeService)
    : localeService.t('sync-ui.status.never-synced');

  return (
    <div
      className={cn('tm:flex tm:flex-col tm:gap-3 tm:rounded-md tm:border tm:border-line tm:bg-one-bg tm:p-4')}
    >
      <div className={cn('tm:flex tm:items-center tm:justify-between tm:gap-4')}>
        <div className={cn('tm:flex tm:flex-col tm:gap-1')}>
          <div className={cn('tm:flex tm:items-center tm:gap-2')}>
            <span className={cn('tm:text-sm tm:font-medium tm:text-light-grey')}>
              {localeService.t('sync-ui.status.title')}
            </span>
            {stateBadge}
          </div>
          <div className={cn('tm:text-xs tm:text-grey-fg')}>
            {lastSyncedText}
            {stats && stats.pendingMutations > 0 && (
              <span className={cn('tm:ml-2 tm:text-yellow')}>
                {localeService.t('sync-ui.status.pending', String(stats.pendingMutations))}
              </span>
            )}
          </div>
        </div>

        <div className={cn('tm:flex tm:items-center tm:gap-3')}>
          <div className={cn('tm:flex tm:items-center tm:gap-2')}>
            <span className={cn('tm:text-xs tm:text-grey-fg')}>
              {localeService.t('sync-ui.status.toggle-label')}
            </span>
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
          <Button
            variant="outline"
            size="sm"
            disabled={state === SyncState.Disabled || busy}
            onClick={() => {
              void handleSyncNow();
            }}
            className={cn('tm:gap-1.5')}
          >
            <RefreshCwIcon className={cn('tm:size-3.5', { 'tm:animate-spin': state === SyncState.Syncing })} />
            {localeService.t('sync-ui.status.sync-now')}
          </Button>
        </div>
      </div>

      {lastError && (
        <div
          role="alert"
          className={cn(`
            tm:flex tm:items-start tm:gap-2 tm:rounded-md tm:bg-red/10 tm:px-3 tm:py-2 tm:text-xs tm:text-red
          `)}
        >
          <TriangleAlertIcon className={cn('tm:mt-0.5 tm:size-3.5 tm:shrink-0')} />
          <div className={cn('tm:flex tm:flex-col tm:gap-1')}>
            <span className={cn('tm:font-medium')}>
              {localeService.t(`sync-ui.error.${lastError.code}`)}
            </span>
            {lastError.message && lastError.message !== lastError.code && (
              <span className={cn('tm:text-grey-fg')}>{lastError.message}</span>
            )}
          </div>
        </div>
      )}

      <div className={cn('tm:flex tm:items-center tm:justify-between tm:border-t tm:border-line tm:pt-3')}>
        <span className={cn('tm:text-xs tm:text-grey-fg')}>
          {localeService.t('sync-ui.status.force-resync-hint')}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={state === SyncState.Disabled || busy}
          onClick={() => {
            void handleForceFullResync();
          }}
          className={cn('tm:gap-1.5 tm:text-xs')}
        >
          <RotateCcwIcon className={cn('tm:size-3.5')} />
          {localeService.t('sync-ui.status.force-resync')}
        </Button>
      </div>
    </div>
  );
}

function renderStateBadge(state: SyncState, localeService: LocaleService): ReactElement {
  if (state === SyncState.Idle) {
    return (
      <Badge variant="secondary" className={cn('tm:gap-1 tm:bg-green/10 tm:text-green')}>
        <CloudCheckIcon className={cn('tm:size-3')} />
        {localeService.t('sync-ui.state.idle')}
      </Badge>
    );
  }
  if (state === SyncState.Syncing) {
    return (
      <Badge variant="secondary" className={cn('tm:gap-1 tm:bg-blue/10 tm:text-blue')}>
        <RefreshCwIcon className={cn('tm:size-3 tm:animate-spin')} />
        {localeService.t('sync-ui.state.syncing')}
      </Badge>
    );
  }
  if (state === SyncState.Offline) {
    return (
      <Badge variant="secondary" className={cn('tm:gap-1 tm:bg-yellow/10 tm:text-yellow')}>
        <CloudOffIcon className={cn('tm:size-3')} />
        {localeService.t('sync-ui.state.offline')}
      </Badge>
    );
  }
  if (state === SyncState.Error) {
    return (
      <Badge variant="secondary" className={cn('tm:gap-1 tm:bg-red/10 tm:text-red')}>
        <TriangleAlertIcon className={cn('tm:size-3')} />
        {localeService.t('sync-ui.state.error')}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={cn('tm:gap-1 tm:bg-grey-fg/20 tm:text-grey-fg')}>
      {localeService.t('sync-ui.state.disabled')}
    </Badge>
  );
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
