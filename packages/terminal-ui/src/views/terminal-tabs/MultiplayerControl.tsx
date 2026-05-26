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
import type { Nullable } from '@termlnk/core';
import type { IDriverState, IParticipant, IShareableSession, ISharedSessionInputPolicy } from '@termlnk/shared-terminal';
import { IAuthService } from '@termlnk/auth';
import { ILogService, LocaleService, Quantity } from '@termlnk/core';
import { Badge, Button, cn, Popover, PopoverContent, PopoverTrigger, toast, Tooltip, TooltipContent, TooltipTrigger, useDependency, useObservable } from '@termlnk/design';
import { IInviteService, ISharedSessionService, SharedTerminalRole } from '@termlnk/shared-terminal';
import { TooltipWrapper } from '@termlnk/ui';
import { CheckIcon, EyeIcon, KeyboardIcon, LinkIcon, SquareIcon, UserIcon, UsersIcon } from 'lucide-react';
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
  const terminalUIService = useDependency(ITerminalUIService);
  const activeSessionId = useObservable<Nullable<string>>(terminalUIService.activeSessionId$);

  // Remount the inner popover on session change. The participants$/driverState$
  // observables get swapped when activeSessionId changes, but redi's
  // useObservable keeps the last value of the prior stream until the new one
  // emits — which would leak the previous tab's participants into the new tab.
  // Keying also resets local state (inviteUrl/copied/busy) and closes the
  // Radix Popover, since each tab's share context is independent.
  return (
    <MultiplayerControlInner
      key={activeSessionId ?? 'none'}
      activeSessionId={activeSessionId ?? null}
    />
  );
}

interface IMultiplayerControlInnerProps {
  readonly activeSessionId: string | null;
}

function MultiplayerControlInner({ activeSessionId }: IMultiplayerControlInnerProps): React.JSX.Element | null {
  const localeService = useDependency(LocaleService);
  const logService = useDependency(ILogService);
  const sharedSession = useDependency(ISharedSessionService, Quantity.OPTIONAL);
  const inviteService = useDependency(IInviteService, Quantity.OPTIONAL);
  const authService = useDependency(IAuthService, Quantity.OPTIONAL);

  const currentUser = useObservable<IUserAccount | null>(authService?.currentUser$ ?? null, null);
  const shareable = useObservable<readonly IShareableSession[]>(sharedSession?.shareable$ ?? null, []);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  // Cache the invite URL across re-renders so the user can copy again without re-creating.
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  /**
   * Pending input policy chosen by the owner before sharing begins. Once the
   * share is live the value is locked — to switch modes the owner must Stop
   * sharing and start again. Mirrors the Termius behaviour where mode is bound
   * to the share, not to individual invites.
   */
  const [pendingPolicy, setPendingPolicy] = useState<ISharedSessionInputPolicy>('allow-input');
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
    if (!sharedSession || !activeEntry?.shared) {
      return EMPTY;
    }
    return sharedSession.participants$(activeEntry.sessionId);
  }, [sharedSession, activeEntry?.sessionId, activeEntry?.shared]);
  const participants = useObservable<readonly IParticipant[]>(participantsObservable, []);

  const driverStateObservable = useMemo(() => {
    if (!sharedSession || !activeEntry?.shared) {
      return EMPTY;
    }
    return sharedSession.driverState$(activeEntry.sessionId);
  }, [sharedSession, activeEntry?.sessionId, activeEntry?.shared]);
  const driverState = useObservable<IDriverState | null>(driverStateObservable, null);

  const handleCopyLink = useCallback(async (): Promise<void> => {
    if (!sharedSession || !inviteService || !activeEntry) {
      return;
    }
    setBusy(true);
    try {
      if (!activeEntry.shared) {
        const options = { inputPolicy: pendingPolicy };
        if (activeEntry.kind === 'ssh') {
          await sharedSession.shareSshSession(activeEntry.sessionId, options);
        } else {
          await sharedSession.sharePtySession(activeEntry.sessionId, options);
        }
      }
      let url = inviteUrl;
      if (!url) {
        const result = await inviteService.createInvite({
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
      toast.error(localeService.t('terminal-ui.multiplayer.copy-failed'), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  }, [sharedSession, inviteService, activeEntry, inviteUrl, pendingPolicy, localeService, logService, clearCopyTimer]);

  const handleStop = useCallback(async (): Promise<void> => {
    if (!sharedSession || !activeEntry) {
      return;
    }
    setBusy(true);
    try {
      await sharedSession.stopSharing(activeEntry.sessionId);
      setInviteUrl(null);
      setCopied(false);
      // Reset the policy toggle so re-opening the popover does not silently
      // pre-select whatever the previous share was — Termius equivalent.
      setPendingPolicy('allow-input');
      clearCopyTimer();
    } catch (err) {
      logService.error('[MultiplayerControl] stop failed:', err);
    } finally {
      setBusy(false);
    }
  }, [sharedSession, activeEntry, logService, clearCopyTimer]);

  const handleToggleKeyboard = useCallback(async (participantId: string, currentlyDriving: boolean): Promise<void> => {
    if (!sharedSession || !activeEntry) {
      return;
    }
    try {
      await sharedSession.setDriver(activeEntry.sessionId, currentlyDriving ? null : participantId);
    } catch (err) {
      logService.error('[MultiplayerControl] toggle-keyboard failed:', err);
    }
  }, [sharedSession, activeEntry, logService]);

  if (!sharedSession || !inviteService || !activeEntry || !currentUser) {
    return null;
  }

  const isShared = activeEntry.shared;
  const currentDriverId = driverState?.driverId ?? null;
  // While shared, the daemon is authoritative — pin the toggle to the actual
  // policy reported on the shareable list so the UI cannot drift from what the
  // joiners are seeing.
  const effectivePolicy: ISharedSessionInputPolicy = isShared
    ? (activeEntry.inputPolicy ?? 'allow-input')
    : pendingPolicy;
  // Driver-status dot colour on the multiplayer trigger:
  //   blue → owner is driving (sole participant or driverId === null)
  //   yellow → some joiner has taken the keyboard
  // The dot is suppressed entirely when the session is not shared.
  const showDriverDot = isShared;
  const driverDotIsJoiner = isShared && currentDriverId !== null;

  return (
    <Popover>
      <TooltipWrapper side="bottom" labelKey="terminal-ui.multiplayer.tooltip">
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn('tm:relative', { 'tm:text-green': isShared })}
          >
            <UsersIcon size={14} strokeWidth={1.5} />
            {showDriverDot && (
              <span
                className={cn(
                  `
                    tm:absolute tm:right-0.5 tm:bottom-0.5 tm:size-1.5 tm:rounded-full tm:ring-1
                    tm:ring-black
                  `,
                  {
                    'tm:bg-yellow': driverDotIsJoiner,
                    'tm:bg-blue': !driverDotIsJoiner,
                  }
                )}
              />
            )}
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
            <div className={cn('tm:flex tm:items-center tm:gap-2 tm:text-sm tm:text-white')}>
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

          <InputPolicyToggle
            policy={effectivePolicy}
            locked={isShared}
            onChange={setPendingPolicy}
            localeService={localeService}
          />

          <div className={cn('tm:h-px tm:bg-line')} />

          {participants.length === 0
            ? (
              <p className={cn('tm:text-center tm:text-xs tm:text-grey-fg')}>
                {localeService.t('terminal-ui.multiplayer.hint-empty')}
              </p>
            )
            : (
              <div className={cn('tm:flex tm:flex-col tm:gap-2')}>
                <span className={cn('tm:text-xs tm:text-white')}>
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
                            disabled={busy}
                            onClick={() => { void handleToggleKeyboard(p.connectionId, isDriver); }}
                            className={cn('tm:size-7', {
                              'tm:bg-blue/15 tm:text-blue tm:hover:bg-blue/25': isDriver,
                              'tm:text-grey-fg tm:hover:text-light-grey': !isDriver,
                            })}
                          >
                            <KeyboardIcon className={cn('tm:size-3.5')} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {localeService.t(isDriver
                            ? 'terminal-ui.multiplayer.release-keyboard'
                            : 'terminal-ui.multiplayer.take-keyboard')}
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

interface IInputPolicyToggleProps {
  readonly policy: ISharedSessionInputPolicy;
  readonly locked: boolean;
  readonly onChange: (next: ISharedSessionInputPolicy) => void;
  readonly localeService: LocaleService;
}

/**
 * Owner-side share-mode picker. Two square buttons (Allow Input vs View only)
 * decide what every joiner can do for the lifetime of the share. The toggle
 * goes read-only once sharing is live — Termius behaviour — and surfaces a
 * hint to nudge the owner into Stop + Share to change modes.
 */
function InputPolicyToggle({ policy, locked, onChange, localeService }: IInputPolicyToggleProps): React.JSX.Element {
  const isAllow = policy === 'allow-input';
  const isView = policy === 'view-only';
  return (
    <div className={cn('tm:flex tm:flex-col tm:gap-1.5')}>
      <span className={cn('tm:text-xs tm:text-white')}>
        {localeService.t('terminal-ui.multiplayer.policy.label')}
      </span>
      <div className={cn('tm:grid tm:grid-cols-2 tm:gap-2')}>
        <PolicyChoiceButton
          icon={<KeyboardIcon className={cn('tm:size-3.5')} />}
          label={localeService.t('terminal-ui.multiplayer.policy.allow-input')}
          description={localeService.t('terminal-ui.multiplayer.policy.allow-input-hint')}
          selected={isAllow}
          disabled={locked}
          onSelect={() => onChange('allow-input')}
        />
        <PolicyChoiceButton
          icon={<EyeIcon className={cn('tm:size-3.5')} />}
          label={localeService.t('terminal-ui.multiplayer.policy.view-only')}
          description={localeService.t('terminal-ui.multiplayer.policy.view-only-hint')}
          selected={isView}
          disabled={locked}
          onSelect={() => onChange('view-only')}
        />
      </div>
      {locked && (
        <span className={cn('tm:text-[11px] tm:text-grey-fg')}>
          {localeService.t('terminal-ui.multiplayer.policy.locked-hint')}
        </span>
      )}
    </div>
  );
}

interface IPolicyChoiceButtonProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly description: string;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly onSelect: () => void;
}

function PolicyChoiceButton(props: IPolicyChoiceButtonProps): React.JSX.Element {
  const { icon, label, description, selected, disabled, onSelect } = props;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        `
          tm:flex tm:flex-col tm:items-start tm:gap-1 tm:rounded-md tm:border tm:p-2
          tm:text-left tm:transition-colors
          tm:disabled:cursor-not-allowed tm:disabled:opacity-60
        `,
        {
          'tm:border-blue tm:bg-blue/10': selected,
          'tm:border-line tm:bg-black tm:hover:bg-one-bg2': !selected && !disabled,
          'tm:border-line tm:bg-black': !selected && disabled,
        }
      )}
    >
      <span
        className={cn('tm:flex tm:items-center tm:gap-1.5 tm:text-xs', {
          'tm:text-blue': selected,
          'tm:text-light-grey': !selected,
        })}
      >
        {icon}
        <span>{label}</span>
      </span>
      <span className={cn('tm:text-[11px] tm:leading-tight tm:text-grey-fg')}>
        {description}
      </span>
    </button>
  );
}
