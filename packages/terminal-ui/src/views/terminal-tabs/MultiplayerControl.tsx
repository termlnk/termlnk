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

import type { Nullable } from '@termlnk/core';
import type { IDriverState, IParticipant, IShareableSession } from '@termlnk/shared-terminal';
import { ILogService, LocaleService, Quantity } from '@termlnk/core';
import { Badge, Button, cn, Popover, PopoverContent, PopoverTrigger, toast, Tooltip, TooltipContent, TooltipTrigger, useDependency, useObservable } from '@termlnk/design';
import { ISharedTerminalService, SharedTerminalRole } from '@termlnk/shared-terminal';
import { TooltipWrapper } from '@termlnk/ui';
import { CheckIcon, KeyboardIcon, LinkIcon, SquareIcon, UserIcon, UsersIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EMPTY } from 'rxjs';
import { ITerminalUIService } from '../../services/terminal/terminal-ui.service';

/**
 * Termius-style "Multiplayer" popover anchored to the terminal tab bar.
 *
 * Surface is scoped to the active terminal session — clicking the icon opens
 * a popover showing share status, copy-link button, and the participant list.
 */
export function MultiplayerControl(): React.JSX.Element | null {
  const localeService = useDependency(LocaleService);
  const logService = useDependency(ILogService);
  const terminalUIService = useDependency(ITerminalUIService);
  const client = useDependency(ISharedTerminalService, Quantity.OPTIONAL);

  const activeSessionId = useObservable<Nullable<string>>(terminalUIService.activeSessionId$);
  const shareable = useObservable<readonly IShareableSession[]>(client?.shareable$ ?? null, []);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  // Cache the invite URL across re-renders so the user can copy again without re-creating.
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  // Track the active "Copied" timer so consecutive clicks restart the countdown
  // rather than letting the visual feedback drop mid-flight.
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCopyTimer = useCallback((): void => {
    if (copyTimerRef.current !== null) {
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearCopyTimer();
  }, [clearCopyTimer]);

  const activeEntry = useMemo(() => {
    if (!activeSessionId) {
      return null;
    }
    return shareable.find((s) => s.sessionId === activeSessionId) ?? null;
  }, [shareable, activeSessionId]);

  // Always subscribe (hooks must be unconditional) but pass EMPTY when no
  // session/sharing — useObservable then yields the seed value.
  const participantsObservable = useMemo(() => {
    if (!client || !activeEntry?.shared) {
      return EMPTY;
    }
    return client.participants$(activeEntry.sessionId);
  }, [client, activeEntry?.sessionId, activeEntry?.shared]);
  const participants = useObservable<readonly IParticipant[]>(participantsObservable, []);

  const driverStateObservable = useMemo(() => {
    if (!client || !activeEntry?.shared) {
      return EMPTY;
    }
    return client.driverState$(activeEntry.sessionId);
  }, [client, activeEntry?.sessionId, activeEntry?.shared]);
  const driverState = useObservable<IDriverState | null>(driverStateObservable, null);

  const handleCopyLink = useCallback(async (): Promise<void> => {
    if (!client || !activeEntry) {
      return;
    }
    setBusy(true);
    try {
      if (!activeEntry.shared) {
        if (activeEntry.kind === 'ssh') {
          await client.shareSshSession(activeEntry.sessionId);
        } else {
          await client.sharePtySession(activeEntry.sessionId);
        }
      }
      let url = inviteUrl;
      if (!url) {
        const result = await client.createInvite({
          sessionId: activeEntry.sessionId,
          role: SharedTerminalRole.CoPilot,
          ttlMs: 15 * 60 * 1000,
          singleUse: false,
        });
        url = result.url;
        setInviteUrl(url);
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearCopyTimer();
      copyTimerRef.current = setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, 2000);
    } catch (err) {
      logService.error('[MultiplayerControl] copy-link failed:', err);
      toast.error(localeService.t('terminal-ui.multiplayer.copy-failed'));
    } finally {
      setBusy(false);
    }
  }, [client, activeEntry, inviteUrl, localeService, logService, clearCopyTimer]);

  const handleStop = useCallback(async (): Promise<void> => {
    if (!client || !activeEntry) {
      return;
    }
    setBusy(true);
    try {
      await client.stopSharing(activeEntry.sessionId);
      setInviteUrl(null);
      setCopied(false);
      clearCopyTimer();
    } catch (err) {
      logService.error('[MultiplayerControl] stop failed:', err);
    } finally {
      setBusy(false);
    }
  }, [client, activeEntry, logService, clearCopyTimer]);

  const handleTakeKeyboard = useCallback(async (participantId: string): Promise<void> => {
    if (!client || !activeEntry) {
      return;
    }
    try {
      await client.setDriver(activeEntry.sessionId, participantId);
    } catch (err) {
      logService.error('[MultiplayerControl] take-keyboard failed:', err);
    }
  }, [client, activeEntry, logService]);

  if (!client || !activeEntry) {
    return null;
  }

  const isShared = activeEntry.shared;
  const currentDriverId = driverState?.driverId ?? null;

  return (
    <Popover>
      <TooltipWrapper side="bottom" labelKey="terminal-ui.multiplayer.tooltip">
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn({ 'tm:text-green': isShared })}
          >
            <UsersIcon size={14} strokeWidth={1.5} />
          </Button>
        </PopoverTrigger>
      </TooltipWrapper>
      <PopoverContent
        align="end"
        sideOffset={6}
        className={cn('tm:w-[360px] tm:p-3')}
      >
        <div className={cn('tm:flex tm:flex-col tm:gap-3')}>
          <div className={cn('tm:flex tm:items-center tm:justify-between tm:gap-2')}>
            <div className={cn('tm:flex tm:items-center tm:gap-2 tm:text-sm tm:text-light-grey')}>
              <UsersIcon className={cn('tm:size-4')} />
              <span>{localeService.t('terminal-ui.multiplayer.title')}</span>
            </div>
            <div className={cn('tm:flex tm:items-center tm:gap-2')}>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => { void handleCopyLink(); }}
                className={cn('tm:gap-1.5', { 'tm:text-green': copied })}
              >
                {copied
                  ? (
                    <>
                      <CheckIcon className={cn('tm:size-3.5')} />
                      {localeService.t('terminal-ui.multiplayer.copied')}
                    </>
                  )
                  : (
                    <>
                      <LinkIcon className={cn('tm:size-3.5')} />
                      {localeService.t('terminal-ui.multiplayer.copy-link')}
                    </>
                  )}
              </Button>
              {isShared && (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={() => { void handleStop(); }}
                  className={cn('tm:gap-1.5')}
                >
                  <SquareIcon className={cn('tm:size-3.5')} />
                  {localeService.t('terminal-ui.multiplayer.stop')}
                </Button>
              )}
            </div>
          </div>

          <div className={cn('tm:h-px tm:bg-line')} />

          {participants.length === 0
            ? (
              <p className={cn('tm:text-center tm:text-xs tm:text-grey-fg')}>
                {localeService.t('terminal-ui.multiplayer.hint-empty')}
              </p>
            )
            : (
              <div className={cn('tm:flex tm:flex-col tm:gap-2')}>
                <span className={cn('tm:text-xs tm:text-grey-fg')}>
                  {localeService.t('terminal-ui.multiplayer.participants')}
                </span>
                {participants.map((p) => {
                  const isDriver = currentDriverId === p.connectionId;
                  return (
                    <div
                      key={p.connectionId}
                      className={cn(`
                        tm:flex tm:items-center tm:justify-between tm:gap-2 tm:rounded-md tm:bg-black tm:px-2 tm:py-1.5
                      `)}
                    >
                      <div className={cn('tm:flex tm:min-w-0 tm:items-center tm:gap-2')}>
                        <span
                          className={cn(`
                            tm:flex tm:size-7 tm:shrink-0 tm:items-center tm:justify-center tm:rounded-full
                            tm:bg-one-bg2 tm:text-grey-fg
                          `)}
                        >
                          <UserIcon className={cn('tm:size-3.5')} />
                        </span>
                        <span className={cn('tm:truncate tm:text-sm tm:text-light-grey')}>
                          {p.displayName || p.connectionId.slice(0, 8)}
                        </span>
                        {p.isCurrent && (
                          <Badge variant="secondary" className={cn('tm:bg-blue/10 tm:text-blue')}>
                            {localeService.t('terminal-ui.multiplayer.you')}
                          </Badge>
                        )}
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isDriver || busy}
                            onClick={() => { void handleTakeKeyboard(p.connectionId); }}
                            className={cn('tm:size-7', {
                              'tm:text-blue': isDriver,
                              'tm:text-grey-fg tm:hover:text-light-grey': !isDriver,
                            })}
                          >
                            <KeyboardIcon className={cn('tm:size-3.5')} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {localeService.t('terminal-ui.multiplayer.take-keyboard')}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
