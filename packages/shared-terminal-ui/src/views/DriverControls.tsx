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

import type { IDriverState, IParticipant, ISharedSession } from '@termlnk/shared-terminal';
import { ILogService, LocaleService } from '@termlnk/core';
import { Badge, Button, cn, useDependency, useObservable } from '@termlnk/design';
import { IPtyMultiplexerService, isWriterRole, SHARED_TERMINAL_DRIVER_HEARTBEAT_TIMEOUT_MS } from '@termlnk/shared-terminal';
import { KeyboardIcon, KeyboardOffIcon, LockIcon, UnlockIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const EMPTY_DRIVER: IDriverState = {
  sessionId: '',
  driverId: null,
  lastHeartbeatAt: 0,
  locked: false,
};

/**
 * Per-session driver lock controls (P5.5.4).
 *
 * Renders:
 *   - badge showing the current driver (clientId) and lock state
 *   - typing indicator (pulse) when the driver heartbeat is fresh (< 5 s)
 *   - "Take keyboard" / "Release keyboard" / "Lock to me" / "Unlock" actions
 *
 * The owner-side daemon owns the authoritative state via PtyMultiplexerService; this
 * component is a thin reactive view over driverState$ + participants$.
 */
export function DriverControls(props: { session: ISharedSession; ownerClientId: string }): React.JSX.Element | null {
  const { session, ownerClientId } = props;
  const localeService = useDependency(LocaleService);
  const logService = useDependency(ILogService);
  const mux = useDependency(IPtyMultiplexerService);

  const driver = useObservable<IDriverState>(mux.driverState$(session.id), EMPTY_DRIVER);
  const participants = useObservable<readonly IParticipant[]>(mux.participants$(session.id), []);
  const [busy, setBusy] = useState(false);

  const driverLabel = useMemo(() => {
    if (!driver.driverId) {
      return localeService.t('shared-terminal-ui.driver.none');
    }
    const named = participants.find((p) => p.connectionId === driver.driverId)?.displayName;
    return named ?? driver.driverId;
  }, [driver, participants, localeService]);

  // Typing indicator state — fresh heartbeat means the driver is actively present.
  // Stale (>= heartbeat-timeout) flags them as unresponsive; the daemon will reap shortly.
  const [isFresh, setIsFresh] = useState(false);
  useEffect(() => {
    if (!driver.driverId) {
      setIsFresh(false);
      return undefined;
    }
    const refresh = () => {
      const stale = Date.now() - driver.lastHeartbeatAt > SHARED_TERMINAL_DRIVER_HEARTBEAT_TIMEOUT_MS;
      setIsFresh(!stale);
    };
    refresh();
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, [driver]);

  // Whether the local "owner client" can claim keyboard. The owner is implicitly a writer.
  const canTake = !driver.locked || driver.driverId === ownerClientId;
  const isOwnerDriver = driver.driverId === ownerClientId;

  // Surface other attached writers (informational) so the operator knows who would compete.
  const otherWriters = useMemo(
    () => participants.filter((p) => p.connectionId !== ownerClientId && isWriterRole(p.role)),
    [participants, ownerClientId]
  );

  const handleTake = (): void => {
    setBusy(true);
    try {
      mux.setDriver(session.id, ownerClientId);
    } catch (err) {
      logService.error('[DriverControls] take keyboard failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const handleRelease = (): void => {
    setBusy(true);
    try {
      mux.setDriver(session.id, null);
    } catch (err) {
      logService.error('[DriverControls] release keyboard failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const handleLock = (): void => {
    setBusy(true);
    try {
      mux.lockDriver(session.id, ownerClientId);
    } catch (err) {
      logService.error('[DriverControls] lock keyboard failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = (): void => {
    setBusy(true);
    try {
      mux.unlockDriver(session.id);
    } catch (err) {
      logService.error('[DriverControls] unlock keyboard failed:', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('tm:flex tm:flex-col tm:gap-2')}>
      <div className={cn('tm:flex tm:flex-wrap tm:items-center tm:gap-2 tm:text-xs')}>
        <Badge
          variant="secondary"
          className={cn('tm:gap-1', {
            'tm:bg-green/10 tm:text-green': isOwnerDriver,
            'tm:bg-blue/10 tm:text-blue': !isOwnerDriver && driver.driverId !== null,
            'tm:bg-grey-fg/20 tm:text-grey-fg': driver.driverId === null,
          })}
        >
          <KeyboardIcon className={cn('tm:size-3')} />
          {localeService.t('shared-terminal-ui.driver.label', driverLabel)}
        </Badge>
        {driver.locked && (
          <Badge variant="secondary" className={cn('tm:gap-1 tm:bg-yellow/10 tm:text-yellow')}>
            <LockIcon className={cn('tm:size-3')} />
            {localeService.t('shared-terminal-ui.driver.locked')}
          </Badge>
        )}
        {isFresh && driver.driverId !== null && (
          <Badge variant="secondary" className={cn('tm:gap-1 tm:bg-green/10 tm:text-green')}>
            <span
              aria-hidden
              className={cn(`
                tm:inline-block tm:size-2 tm:animate-pulse tm:rounded-full tm:bg-green
              `)}
            />
            {localeService.t('shared-terminal-ui.driver.typing')}
          </Badge>
        )}
        {otherWriters.length > 0 && (
          <span className={cn('tm:text-grey-fg')}>
            {localeService.t('shared-terminal-ui.driver.other-writers', String(otherWriters.length))}
          </span>
        )}
      </div>
      <div className={cn('tm:flex tm:flex-wrap tm:gap-2')}>
        {isOwnerDriver
          ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={handleRelease}
              className={cn('tm:gap-1.5')}
            >
              <KeyboardOffIcon className={cn('tm:size-3.5')} />
              {localeService.t('shared-terminal-ui.driver.release')}
            </Button>
          )
          : (
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !canTake}
              onClick={handleTake}
              className={cn('tm:gap-1.5')}
            >
              <KeyboardIcon className={cn('tm:size-3.5')} />
              {localeService.t('shared-terminal-ui.driver.take')}
            </Button>
          )}
        {driver.locked
          ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !isOwnerDriver}
              onClick={handleUnlock}
              className={cn('tm:gap-1.5')}
            >
              <UnlockIcon className={cn('tm:size-3.5')} />
              {localeService.t('shared-terminal-ui.driver.unlock')}
            </Button>
          )
          : (
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !isOwnerDriver}
              onClick={handleLock}
              className={cn('tm:gap-1.5')}
            >
              <LockIcon className={cn('tm:size-3.5')} />
              {localeService.t('shared-terminal-ui.driver.lock')}
            </Button>
          )}
      </div>
    </div>
  );
}
