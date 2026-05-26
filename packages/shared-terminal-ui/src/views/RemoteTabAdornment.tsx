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

import type { ITabAdornmentProps } from '@termlnk/terminal-ui';
import type { ISharedSessionInputPolicy } from '@termlnk/shared-terminal';
import { ILogService, LocaleService, Quantity } from '@termlnk/core';
import { Badge, Button, cn, Popover, PopoverContent, PopoverTrigger, useDependency, useObservable } from '@termlnk/design';
import { IRemoteSessionService, RemoteSessionStatus } from '@termlnk/shared-terminal';
import { CrownIcon, EyeIcon, KeyboardIcon, LockIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { EMPTY } from 'rxjs';

/**
 * Right-side adornment for a remote-session tab. Renders a keyboard icon
 * button whose popover surfaces the driver/observer role, connection state,
 * the request/release-keyboard action, and the most recent connection error.
 *
 * Mounted by `TerminalTabItem` via `ITerminalViewRegistry.getTabAdornment`
 * — instances are scoped to a single tab/sessionId and subscribe only to the
 * per-session streams on `IRemoteSessionService`, so two remote tabs render
 * independently with no cross-talk.
 */
export function RemoteTabAdornment(props: ITabAdornmentProps): React.JSX.Element | null {
  const { sessionId } = props;
  const localeService = useDependency(LocaleService);
  const logService = useDependency(ILogService);
  const remote = useDependency(IRemoteSessionService, Quantity.OPTIONAL);
  const [open, setOpen] = useState(false);

  const stateObservable = useMemo(
    () => remote?.status$(sessionId) ?? EMPTY,
    [remote, sessionId]
  );
  const connectionState = useObservable<RemoteSessionStatus>(stateObservable, RemoteSessionStatus.IDLE);

  const driverIdObservable = useMemo(
    () => remote?.driverId$(sessionId) ?? EMPTY,
    [remote, sessionId]
  );
  const driverId = useObservable<string | null>(driverIdObservable, null);

  const connectionIdObservable = useMemo(
    () => remote?.connectionId$(sessionId) ?? EMPTY,
    [remote, sessionId]
  );
  const myClientId = useObservable<string | null>(connectionIdObservable, null);

  const lastErrorObservable = useMemo(
    () => remote?.error$(sessionId) ?? EMPTY,
    [remote, sessionId]
  );
  const lastError = useObservable<string | null>(lastErrorObservable, null);

  const inputPolicyObservable = useMemo(
    () => remote?.inputPolicy$(sessionId) ?? EMPTY,
    [remote, sessionId]
  );
  const inputPolicy = useObservable<ISharedSessionInputPolicy>(inputPolicyObservable, 'allow-input');

  const isDriver = useMemo(
    // First clause guards the idle case where BOTH driverId and myClientId
    // are null. Without it `null === null` would erroneously promote a
    // not-yet-connected observer to "driver".
    () => driverId !== null && driverId === myClientId,
    [driverId, myClientId]
  );
  const isConnected = connectionState === RemoteSessionStatus.CONNECTED;
  const isViewOnly = inputPolicy === 'view-only';
  // Status-dot colour on the keyboard icon, mirroring the owner-side trigger:
  //   blue → I am the driver
  //   yellow → another joiner / owner is driving
  //   grey → nobody drives yet (initial state on first attach)
  const driverDotTone: 'self' | 'other' | 'idle' = isDriver
    ? 'self'
    : driverId !== null
      ? 'other'
      : 'idle';

  const handleRequestKeyboard = useCallback(async () => {
    if (!remote) {
      return;
    }
    try {
      await remote.sendControl(sessionId, { type: 'driver_request' });
    } catch (err) {
      logService.warn('[RemoteTabAdornment] driver_request failed:', err);
    }
  }, [remote, logService, sessionId]);

  const handleReleaseKeyboard = useCallback(async () => {
    if (!remote) {
      return;
    }
    try {
      await remote.sendControl(sessionId, { type: 'driver_release' });
    } catch (err) {
      logService.warn('[RemoteTabAdornment] driver_release failed:', err);
    }
  }, [remote, logService, sessionId]);

  if (!remote) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className={cn(
            `
              tm:relative tm:flex tm:size-4.5 tm:shrink-0 tm:bg-transparent
              tm:hover:bg-one-bg2
            `,
            {
              'tm:text-yellow': isDriver,
              'tm:text-light-grey': !isDriver && !lastError,
              'tm:text-red': !!lastError,
            }
          )}
          aria-label={localeService.t('shared-terminal-ui.remote.popover.aria-label')}
          // The button lives inside a tab whose outer div listens for
          // pointerdown to arm drag-init and click to select the tab. Stop
          // here so opening the popover doesn't start a drag or switch tabs.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <KeyboardIcon size={12} strokeWidth={1.5} />
          {/* Persistent driver-status dot, suppressed before the relay handshake. */}
          {isConnected && (
            <span
              className={cn(
                `
                  tm:absolute tm:right-0 tm:bottom-0 tm:size-1.5 tm:rounded-full tm:ring-1
                  tm:ring-black
                `,
                {
                  'tm:bg-blue': driverDotTone === 'self',
                  'tm:bg-yellow': driverDotTone === 'other',
                  'tm:bg-grey': driverDotTone === 'idle',
                }
              )}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className={cn('tm:w-64 tm:p-3')}
      >
        <div className={cn('tm:flex tm:flex-col tm:gap-3')}>
          <div className={cn('tm:flex tm:flex-col tm:gap-1.5')}>
            {isDriver
              ? (
                <Badge variant="secondary" className={cn('tm:w-fit tm:gap-1 tm:bg-yellow/15 tm:text-yellow')}>
                  <CrownIcon className={cn('tm:size-3')} />
                  {localeService.t('shared-terminal-ui.remote.driving')}
                </Badge>
              )
              : (
                <Badge variant="secondary" className={cn('tm:w-fit tm:gap-1 tm:bg-blue/10 tm:text-blue')}>
                  <EyeIcon className={cn('tm:size-3')} />
                  {localeService.t('shared-terminal-ui.remote.viewing-only')}
                </Badge>
              )}
            <span className={cn('tm:text-xs tm:text-grey-fg')}>
              {stateLabel(connectionState, localeService)}
            </span>
          </div>

          <div className={cn('tm:h-px tm:w-full tm:bg-line')} />

          {isViewOnly
            ? (
              <div className={cn('tm:flex tm:flex-col tm:gap-1.5')}>
                <div
                  className={cn(`
                    tm:flex tm:items-center tm:gap-1.5 tm:rounded-md tm:bg-one-bg tm:px-2 tm:py-2
                    tm:text-xs tm:text-grey-fg
                  `)}
                >
                  <LockIcon className={cn('tm:size-3.5')} />
                  <span>{localeService.t('shared-terminal-ui.remote.view-only-badge')}</span>
                </div>
                <p className={cn('tm:text-[11px]/4 tm:text-grey-fg')}>
                  {localeService.t('shared-terminal-ui.remote.view-only-hint')}
                </p>
              </div>
            )
            : (
              <>
                <Button
                  variant={isDriver ? 'outline' : 'default'}
                  size="sm"
                  disabled={!isConnected}
                  onClick={() => { void (isDriver ? handleReleaseKeyboard() : handleRequestKeyboard()); }}
                  className={cn('tm:w-full tm:gap-1.5')}
                >
                  <KeyboardIcon className={cn('tm:size-3.5')} />
                  {isDriver
                    ? localeService.t('shared-terminal-ui.remote.release-keyboard')
                    : localeService.t('shared-terminal-ui.remote.request-keyboard')}
                </Button>

                <p className={cn('tm:text-[11px]/4 tm:text-grey-fg')}>
                  {isDriver
                    ? localeService.t('shared-terminal-ui.remote.driver-hint')
                    : localeService.t('shared-terminal-ui.remote.read-only-hint')}
                </p>
              </>
            )}

          {lastError && (
            <div className={cn('tm:rounded-md tm:border tm:border-red/40 tm:bg-red/10 tm:p-2')}>
              <div className={cn('tm:font-mono tm:text-[11px] tm:break-all tm:text-red/90')}>
                {lastError}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function stateLabel(state: RemoteSessionStatus, locale: { t: (key: string) => string }): string {
  switch (state) {
    case RemoteSessionStatus.CONNECTING:
      return locale.t('shared-terminal-ui.remote.state.connecting');
    case RemoteSessionStatus.CONNECTED:
      return locale.t('shared-terminal-ui.remote.state.connected');
    case RemoteSessionStatus.CLOSED:
      return locale.t('shared-terminal-ui.remote.state.disconnected');
    case RemoteSessionStatus.ERROR:
      return locale.t('shared-terminal-ui.remote.state.error');
    case RemoteSessionStatus.IDLE:
    default:
      return locale.t('shared-terminal-ui.remote.state.idle');
  }
}
