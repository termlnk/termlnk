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

import type { IRecordingHandle, ISharedSession } from '@termlnk/shared-terminal';
import { ILogService, LocaleService, Quantity } from '@termlnk/core';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, cn, useDependency, useObservable } from '@termlnk/design';
import { IPairingService, IPtyMultiplexerService, ISharedSessionRecordingService, SharedSessionState, SharedTerminalRole } from '@termlnk/shared-terminal';
import { CircleDotIcon, CopyIcon, LinkIcon, MonitorUpIcon, SquareIcon, UsersRoundIcon, VideoIcon } from 'lucide-react';
import { useState } from 'react';
import { DriverControls } from './DriverControls';

/**
 * Owner-side client identifier. PtyMultiplexer treats it as just another connection id;
 * using a constant lets the owner explicitly claim/release the driver lock from this UI
 * without forcing a global "is owner" concept onto the contract layer.
 */
const OWNER_CLIENT_ID = '__termlnk-owner__';

export function SharedTerminalPanel() {
  const localeService = useDependency(LocaleService);
  const logService = useDependency(ILogService);
  const pairing = useDependency(IPairingService, Quantity.OPTIONAL);
  const mux = useDependency(IPtyMultiplexerService, Quantity.OPTIONAL);
  const recording = useDependency(ISharedSessionRecordingService, Quantity.OPTIONAL);
  const sessions = useObservable<readonly ISharedSession[]>(mux?.sessions$ ?? null, []);
  const activeRecordings = useObservable<readonly IRecordingHandle[]>(
    recording?.activeRecordings$ ?? null,
    []
  );
  const [inviteUrl, setInviteUrl] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const unavailable = !pairing || !mux || !recording;

  const handleCreateInvite = async (session: ISharedSession): Promise<void> => {
    if (!pairing) {
      return;
    }
    setBusy(true);
    try {
      const result = await pairing.createInvite({
        sessionId: session.id,
        role: SharedTerminalRole.CoPilot,
        ttlMs: 15 * 60 * 1000,
        singleUse: true,
      });
      setInviteUrl(result.url);
      await navigator.clipboard.writeText(result.url);
    } catch (err) {
      logService.error('[SharedTerminalPanel] create invite failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const handleCopyInvite = async (): Promise<void> => {
    if (!inviteUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch (err) {
      logService.error('[SharedTerminalPanel] copy invite failed:', err);
    }
  };

  const handleStartRecording = async (session: ISharedSession): Promise<void> => {
    if (!recording) {
      return;
    }
    setBusy(true);
    try {
      await recording.start({ sessionId: session.id, title: session.title, mandatory: false });
    } catch (err) {
      logService.error('[SharedTerminalPanel] start recording failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const handleStopRecording = async (handle: IRecordingHandle): Promise<void> => {
    if (!recording) {
      return;
    }
    setBusy(true);
    try {
      await recording.stop(handle, handle.mandatory);
    } catch (err) {
      logService.error('[SharedTerminalPanel] stop recording failed:', err);
    } finally {
      setBusy(false);
    }
  };

  if (unavailable) {
    return (
      <Card className={cn('tm:bg-one-bg')}>
        <CardHeader>
          <CardTitle className={cn('tm:flex tm:items-center tm:gap-2')}>
            <MonitorUpIcon className={cn('tm:size-4 tm:text-blue')} />
            {localeService.t('shared-terminal-ui.panel.title')}
          </CardTitle>
          <CardDescription>
            {localeService.t('shared-terminal-ui.panel.unavailable')}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className={cn('tm:flex tm:flex-col tm:gap-4')}>
      <Card className={cn('tm:bg-one-bg')}>
        <CardHeader>
          <CardTitle className={cn('tm:flex tm:items-center tm:gap-2')}>
            <UsersRoundIcon className={cn('tm:size-4 tm:text-green')} />
            {localeService.t('shared-terminal-ui.sessions.title')}
          </CardTitle>
          <CardDescription>
            {localeService.t('shared-terminal-ui.sessions.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className={cn('tm:flex tm:flex-col tm:gap-2')}>
          {sessions.length === 0 && (
            <div
              className={cn('tm:rounded-md tm:border tm:border-dashed tm:border-line tm:p-4 tm:text-sm tm:text-grey-fg')}
            >
              {localeService.t('shared-terminal-ui.sessions.empty')}
            </div>
          )}
          {sessions.map((session) => {
            const handle = activeRecordings.find((item) => item.sessionId === session.id);
            return (
              <div
                key={session.id}
                className={cn(`
                  tm:flex tm:flex-col tm:gap-3 tm:rounded-md tm:border tm:border-line
                  tm:bg-black tm:px-3 tm:py-2
                `)}
              >
                <div className={cn('tm:grid tm:grid-cols-[1fr_auto] tm:items-center tm:gap-3')}>
                <div className={cn('tm:flex tm:min-w-0 tm:flex-col tm:gap-1')}>
                  <div className={cn('tm:flex tm:min-w-0 tm:items-center tm:gap-2')}>
                    <span className={cn('tm:truncate tm:text-sm tm:text-light-grey')}>{session.title}</span>
                    {renderSessionBadge(session.state, localeService)}
                    {handle && (
                      <Badge variant="secondary" className={cn('tm:gap-1 tm:bg-red/10 tm:text-red')}>
                        <CircleDotIcon className={cn('tm:size-3 tm:fill-current')} />
                        {localeService.t('shared-terminal-ui.recording.active')}
                      </Badge>
                    )}
                  </div>
                  <div
                    className={cn(`
                      tm:flex tm:flex-wrap tm:items-center tm:gap-x-3 tm:gap-y-1 tm:text-xs tm:text-grey-fg
                    `)}
                  >
                    <span>
                      {session.cols}
                      x
                      {session.rows}
                    </span>
                    <span>{localeService.t('shared-terminal-ui.sessions.participants', String(session.participantIds.length))}</span>
                    <span>{localeService.t('shared-terminal-ui.sessions.driver', session.driverId ?? '-')}</span>
                  </div>
                </div>
                <div className={cn('tm:flex tm:flex-wrap tm:justify-end tm:gap-2')}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      void handleCreateInvite(session);
                    }}
                    className={cn('tm:gap-1.5')}
                  >
                    <LinkIcon className={cn('tm:size-3.5')} />
                    {localeService.t('shared-terminal-ui.invite.create')}
                  </Button>
                  {handle
                    ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          void handleStopRecording(handle);
                        }}
                        className={cn('tm:gap-1.5')}
                      >
                        <SquareIcon className={cn('tm:size-3.5')} />
                        {localeService.t('shared-terminal-ui.recording.stop')}
                      </Button>
                    )
                    : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          void handleStartRecording(session);
                        }}
                        className={cn('tm:gap-1.5')}
                      >
                        <VideoIcon className={cn('tm:size-3.5')} />
                        {localeService.t('shared-terminal-ui.recording.start')}
                      </Button>
                    )}
                  </div>
                </div>
                <DriverControls session={session} ownerClientId={OWNER_CLIENT_ID} />
              </div>
            );
          })}
          {inviteUrl && (
            <div
              className={cn(`
                tm:grid tm:grid-cols-[1fr_auto] tm:items-center tm:gap-2 tm:rounded-md tm:border tm:border-line
                tm:bg-black tm:p-3
              `)}
            >
              <span className={cn('tm:min-w-0 tm:truncate tm:text-xs tm:text-grey-fg')}>{inviteUrl}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void handleCopyInvite();
                }}
                className={cn('tm:gap-1.5')}
              >
                <CopyIcon className={cn('tm:size-3.5')} />
                {localeService.t('shared-terminal-ui.invite.copy')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function renderSessionBadge(state: SharedSessionState, localeService: LocaleService) {
  if (state === SharedSessionState.Active) {
    return (
      <Badge variant="secondary" className={cn('tm:bg-green/10 tm:text-green')}>
        {localeService.t('shared-terminal-ui.session-state.active')}
      </Badge>
    );
  }
  if (state === SharedSessionState.Recording) {
    return (
      <Badge variant="secondary" className={cn('tm:bg-red/10 tm:text-red')}>
        {localeService.t('shared-terminal-ui.session-state.recording')}
      </Badge>
    );
  }
  if (state === SharedSessionState.Closed) {
    return (
      <Badge variant="secondary" className={cn('tm:bg-grey-fg/20 tm:text-grey-fg')}>
        {localeService.t('shared-terminal-ui.session-state.closed')}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={cn('tm:bg-blue/10 tm:text-blue')}>
      {localeService.t('shared-terminal-ui.session-state.idle')}
    </Badge>
  );
}
