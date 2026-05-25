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

import type { IDriverState } from '@termlnk/shared-terminal';
import type { ITabAdornmentProps } from '@termlnk/terminal-ui';
import { ILogService, LocaleService, Quantity } from '@termlnk/core';
import { Badge, Button, cn, Popover, PopoverContent, PopoverTrigger, useDependency, useObservable } from '@termlnk/design';
import { ClientConnectionState, ISharedTerminalService } from '@termlnk/shared-terminal';
import { CrownIcon, EyeIcon, KeyboardIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { EMPTY } from 'rxjs';

/**
 * Right-side adornment for a remote-session tab. Renders a keyboard icon
 * button whose popover surfaces the driver/observer role, connection state,
 * the request/release-keyboard action, and the most recent connection error.
 *
 * Mounted by `TerminalTabItem` via `ITerminalViewRegistry.getTabAdornment`
 * — instances are scoped to a single tab/sessionId and subscribe only to the
 * per-session streams on `ISharedTerminalService`, so two remote tabs render
 * independently with no cross-talk.
 */
export function RemoteTabAdornment(props: ITabAdornmentProps): React.JSX.Element | null {
  const { sessionId } = props;
  const localeService = useDependency(LocaleService);
  const logService = useDependency(ILogService);
  const client = useDependency(ISharedTerminalService, Quantity.OPTIONAL);
  const [open, setOpen] = useState(false);

  const stateObservable = useMemo(
    () => client?.participantState$(sessionId) ?? EMPTY,
    [client, sessionId]
  );
  const connectionState = useObservable<ClientConnectionState>(stateObservable, ClientConnectionState.Idle);

  const driverStateObservable = useMemo(
    () => client?.driverState$(sessionId) ?? EMPTY,
    [client, sessionId]
  );
  const driverState = useObservable<IDriverState | null>(driverStateObservable, null);

  const connectionIdObservable = useMemo(
    () => client?.participantConnectionId$(sessionId) ?? EMPTY,
    [client, sessionId]
  );
  const myClientId = useObservable<string | null>(connectionIdObservable, null);

  const lastErrorObservable = useMemo(
    () => client?.participantLastError$(sessionId) ?? EMPTY,
    [client, sessionId]
  );
  const lastError = useObservable<string | null>(lastErrorObservable, null);

  const isDriver = useMemo(
    // First clause guards the idle case where BOTH `driverState.driverId` and
    // `myClientId` are null (no driver yet, this client not connected). Without
    // it the equality `null === null` would erroneously promote a not-yet-
    // connected observer to "driver".
    () => driverState?.driverId !== null && driverState?.driverId === myClientId,
    [driverState, myClientId]
  );
  const isConnected = connectionState === ClientConnectionState.Connected;

  const handleRequestKeyboard = useCallback(async () => {
    if (!client) {
      return;
    }
    try {
      await client.sendParticipantControl(sessionId, { type: 'driver_request' });
    } catch (err) {
      logService.warn('[RemoteTabAdornment] driver_request failed:', err);
    }
  }, [client, logService, sessionId]);

  const handleReleaseKeyboard = useCallback(async () => {
    if (!client) {
      return;
    }
    try {
      await client.sendParticipantControl(sessionId, { type: 'driver_release' });
    } catch (err) {
      logService.warn('[RemoteTabAdornment] driver_release failed:', err);
    }
  }, [client, logService, sessionId]);

  if (!client) {
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
              tm:flex tm:size-4.5 tm:shrink-0 tm:bg-transparent
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

function stateLabel(state: ClientConnectionState, locale: { t: (key: string) => string }): string {
  switch (state) {
    case ClientConnectionState.Pairing:
      return locale.t('shared-terminal-ui.remote.state.pairing');
    case ClientConnectionState.Connecting:
      return locale.t('shared-terminal-ui.remote.state.connecting');
    case ClientConnectionState.Connected:
      return locale.t('shared-terminal-ui.remote.state.connected');
    case ClientConnectionState.Disconnected:
      return locale.t('shared-terminal-ui.remote.state.disconnected');
    case ClientConnectionState.Error:
      return locale.t('shared-terminal-ui.remote.state.error');
    case ClientConnectionState.Idle:
    default:
      return locale.t('shared-terminal-ui.remote.state.idle');
  }
}
