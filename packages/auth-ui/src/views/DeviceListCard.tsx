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

import type { IDevice } from '@termlnk/auth';
import { AuthState, IAuthService } from '@termlnk/auth';
import { IConfirmService, ILogService, LocaleService, Quantity } from '@termlnk/core';
import { Badge, Button, cn, useDependency, useObservable } from '@termlnk/design';
import { LaptopIcon, LockIcon, TrashIcon, TriangleAlertIcon } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';

export interface IDeviceListCardProps {
  readonly onLoadingChange?: (loading: boolean) => void;
}

export interface IDeviceListCardHandle {
  refresh: () => void;
}

export const DeviceListCard = forwardRef<IDeviceListCardHandle, IDeviceListCardProps>(function DeviceListCard(props, ref) {
  const localeService = useDependency(LocaleService);
  const logService = useDependency(ILogService);
  const confirmService = useDependency(IConfirmService);
  const authClient = useDependency(IAuthService, Quantity.OPTIONAL);

  const authState = useObservable<AuthState>(
    authClient?.authState$ ?? null,
    AuthState.Unauthenticated
  );

  const [devices, setDevices] = useState<readonly IDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const isUnlocked = authState === AuthState.Authenticated;

  const loadDevices = useCallback(async () => {
    if (!authClient || !isUnlocked) {
      return;
    }
    setLoading(true);
    props.onLoadingChange?.(true);
    setError(null);
    try {
      const list = await authClient.listDevices();
      setDevices(list);
    } catch (err) {
      logService.error('[DeviceListCard] listDevices failed:', err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
      props.onLoadingChange?.(false);
    }
  }, [authClient, isUnlocked, logService, props]);

  useImperativeHandle(ref, () => ({
    refresh: () => { void loadDevices(); },
  }), [loadDevices]);

  useEffect(() => {
    if (isUnlocked) {
      void loadDevices();
    } else {
      setDevices([]);
      setError(null);
    }
  }, [isUnlocked, loadDevices]);

  const handleRevoke = useCallback(async (device: IDevice) => {
    if (!authClient) {
      return;
    }

    const label = device.deviceName?.trim().length
      ? device.deviceName
      : localeService.t('auth-ui.devices.unnamed-device');

    const confirmed = await confirmService.confirm({
      id: `auth-ui.devices.revoke-confirm.${device.id}`,
      title: { title: localeService.t('auth-ui.devices.revoke-confirm-title') },
      description: {
        title: device.isCurrent
          ? localeService.t('auth-ui.devices.revoke-confirm-current', label)
          : localeService.t('auth-ui.devices.revoke-confirm-other', label),
      },
      confirmText: localeService.t('auth-ui.devices.revoke'),
      cancelText: localeService.t('auth-ui.devices.cancel'),
      confirmVariant: 'destructive',
    });
    if (!confirmed) {
      return;
    }

    setRevokingId(device.id);
    try {
      await authClient.revokeDevice(device.id);
      await loadDevices();
    } catch (err) {
      logService.error('[DeviceListCard] revokeDevice failed:', err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setRevokingId(null);
    }
  }, [authClient, confirmService, loadDevices, localeService, logService]);

  if (!authClient) {
    return null;
  }

  return (
    <div className={cn('tm:flex tm:flex-col tm:gap-3')}>
      {!isUnlocked && (
        <div
          className={cn(`
            tm:flex tm:items-start tm:gap-2 tm:rounded-md tm:bg-yellow/10 tm:px-3 tm:py-2 tm:text-xs tm:text-yellow
          `)}
        >
          <LockIcon className={cn('tm:size-4 tm:shrink-0 tm:translate-y-px')} />
          <span>{localeService.t('auth-ui.devices.gated-hint')}</span>
        </div>
      )}

      {isUnlocked && error && (
        <div
          className={cn(`
            tm:flex tm:items-start tm:gap-2 tm:rounded-md tm:bg-red/10 tm:px-3 tm:py-2 tm:text-xs tm:text-red
          `)}
        >
          <TriangleAlertIcon className={cn('tm:size-4 tm:shrink-0 tm:translate-y-px')} />
          <span className={cn('tm:break-all')}>{error}</span>
        </div>
      )}

      {isUnlocked && !error && devices.length === 0 && !loading && (
        <div className={cn('tm:rounded-md tm:bg-black2 tm:px-3 tm:py-2 tm:text-xs tm:text-grey-fg')}>
          {localeService.t('auth-ui.devices.empty')}
        </div>
      )}

      {isUnlocked && devices.length > 0 && (
        <ul className={cn('tm:flex tm:flex-col tm:gap-2')}>
          {devices.map((device) => (
            <DeviceListItem
              key={device.id}
              device={device}
              revoking={revokingId === device.id}
              onRevoke={handleRevoke}
            />
          ))}
        </ul>
      )}
    </div>
  );
});

interface IDeviceListItemProps {
  readonly device: IDevice;
  readonly revoking: boolean;
  readonly onRevoke: (device: IDevice) => Promise<void> | void;
}

function DeviceListItem({ device, revoking, onRevoke }: IDeviceListItemProps) {
  const localeService = useDependency(LocaleService);

  const label = device.deviceName?.trim().length
    ? device.deviceName
    : localeService.t('auth-ui.devices.unnamed-device');

  const lastSeen = formatRelativeTime(device.lastSeenAt, localeService);
  const created = formatAbsoluteDate(device.createdAt);

  return (
    <li
      className={cn(`
        tm:flex tm:items-start tm:justify-between tm:gap-3 tm:rounded-md tm:border tm:border-line tm:bg-black2 tm:px-3
        tm:py-2.5
      `)}
    >
      <div className={cn('tm:flex tm:min-w-0 tm:items-start tm:gap-2.5')}>
        <LaptopIcon className={cn('tm:size-4 tm:shrink-0 tm:translate-y-0.5 tm:text-grey-fg')} />
        <div className={cn('tm:flex tm:min-w-0 tm:flex-col tm:gap-1')}>
          <div className={cn('tm:flex tm:flex-wrap tm:items-center tm:gap-2')}>
            <span className={cn('tm:truncate tm:text-sm tm:font-medium tm:text-light-grey')}>
              {label}
            </span>
            {device.isCurrent && (
              <Badge variant="secondary" className={cn('tm:bg-nord-blue/15 tm:text-nord-blue')}>
                {localeService.t('auth-ui.devices.this-device')}
              </Badge>
            )}
          </div>
          <span className={cn('tm:truncate tm:text-xs tm:text-grey-fg')}>
            {localeService.t('auth-ui.devices.last-seen', lastSeen)}
            {' · '}
            {localeService.t('auth-ui.devices.created', created)}
          </span>
          {device.userAgent && (
            <span className={cn('tm:truncate tm:font-mono tm:text-[11px] tm:text-grey')}>
              {device.userAgent}
            </span>
          )}
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        disabled={revoking}
        onClick={() => { void onRevoke(device); }}
        className={cn('tm:gap-1.5 tm:text-red')}
        aria-label={localeService.t('auth-ui.devices.revoke')}
      >
        <TrashIcon className={cn('tm:size-3.5')} />
        {revoking
          ? localeService.t('auth-ui.devices.revoking')
          : localeService.t('auth-ui.devices.revoke')}
      </Button>
    </li>
  );
}

function formatRelativeTime(iso: string, localeService: LocaleService): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) {
    return iso;
  }
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) {
    return localeService.t('auth-ui.devices.time.just-now');
  }
  if (minutes < 60) {
    return localeService.t('auth-ui.devices.time.minutes-ago', String(minutes));
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return localeService.t('auth-ui.devices.time.hours-ago', String(hours));
  }
  const days = Math.floor(hours / 24);
  return localeService.t('auth-ui.devices.time.days-ago', String(days));
}

// Use the OS locale; LocaleService handles only translatable strings.
function formatAbsoluteDate(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) {
    return iso;
  }
  return new Date(ts).toLocaleDateString();
}
