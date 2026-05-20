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

import type { ICapability } from '@termlnk/shared-terminal';
import { ILogService, LocaleService, Quantity } from '@termlnk/core';
import { Badge, Button, cn, Dialog, useDependency } from '@termlnk/design';
import { ISharedTerminalService } from '@termlnk/shared-terminal';
import { CheckIcon, ClipboardCopyIcon, LinkIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface IInvitePayload {
  inviteId?: string;
  ephPriv?: string;
  capability?: ICapability;
  rawUrl: string;
}

/**
 * Participant-side "you've been invited" dialog.
 *
 * Subscribes to ISharedTerminalService.inviteUrl$ (sourced from the OS
 * deep-link bus through electron-main → tRPC) and parses incoming termlnk:// /
 * https:// invite URLs. Displays the human-readable capability metadata so the
 * recipient can verify the session before opting in.
 *
 * The "Join" action is currently a placeholder — actually attaching to the
 * remote PTY stream depends on the client-side transport layer (see M4b / M5
 * in docs/agent/shared-terminal-multiplayer.md). Dismissing the dialog drops
 * the URL on the floor.
 */
export function ParticipantJoinDialog(): React.JSX.Element | null {
  const localeService = useDependency(LocaleService);
  const logService = useDependency(ILogService);
  const client = useDependency(ISharedTerminalService, Quantity.OPTIONAL);
  const [pending, setPending] = useState<IInvitePayload | null>(null);

  useEffect(() => {
    if (!client) {
      return undefined;
    }
    const sub = client.inviteUrl$.subscribe({
      next: (url) => {
        const parsed = parseInviteUrl(url, logService);
        setPending(parsed);
      },
      error: (err) => logService.error('[ParticipantJoinDialog] inviteUrl$ stream errored:', err),
    });
    return () => sub.unsubscribe();
  }, [client, logService]);

  const handleCopy = async (): Promise<void> => {
    if (!pending) {
      return;
    }
    try {
      await navigator.clipboard.writeText(pending.rawUrl);
    } catch (err) {
      logService.error('[ParticipantJoinDialog] copy invite url failed:', err);
    }
  };

  const handleDismiss = (): void => {
    setPending(null);
  };

  const handleJoin = async (): Promise<void> => {
    if (!client || !pending) {
      return;
    }
    setBusy(true);
    try {
      await client.connectAsParticipant(pending.rawUrl);
      setPending(null);
    } catch (err) {
      logService.error('[ParticipantJoinDialog] join failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const [busy, setBusy] = useState(false);

  if (!pending) {
    return null;
  }

  const cap = pending.capability;
  const expiryDate = cap?.exp ? new Date(cap.exp) : null;
  const canJoin = Boolean(client && cap);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          handleDismiss();
        }
      }}
      title={(
        <span className={cn('tm:flex tm:items-center tm:gap-2')}>
          <LinkIcon className={cn('tm:size-4 tm:text-blue')} />
          {localeService.t('shared-terminal-ui.join-dialog.title')}
        </span>
      )}
      footer={(
        <div className={cn('tm:flex tm:items-center tm:justify-end tm:gap-2')}>
          <Button variant="outline" onClick={handleDismiss} className={cn('tm:gap-1.5')}>
            <XIcon className={cn('tm:size-3.5')} />
            {localeService.t('shared-terminal-ui.join-dialog.dismiss')}
          </Button>
          <Button
            variant="default"
            disabled={!canJoin || busy}
            onClick={() => { void handleJoin(); }}
            className={cn('tm:gap-1.5')}
          >
            <CheckIcon className={cn('tm:size-3.5')} />
            {localeService.t('shared-terminal-ui.join-dialog.join')}
          </Button>
        </div>
      )}
    >
      <div className={cn('tm:flex tm:flex-col tm:gap-3 tm:px-1 tm:py-2 tm:text-sm tm:text-light-grey')}>
        <p className={cn('tm:text-grey-fg')}>
          {localeService.t('shared-terminal-ui.join-dialog.description')}
        </p>
        <div className={cn('tm:rounded-md tm:border tm:border-line tm:bg-black tm:p-3 tm:font-mono tm:text-xs')}>
          <div className={cn('tm:flex tm:items-center tm:justify-between tm:gap-2')}>
            <span className={cn('tm:truncate tm:text-light-grey')}>{pending.rawUrl}</span>
            <Button variant="outline" size="sm" onClick={() => { void handleCopy(); }} className={cn('tm:gap-1.5')}>
              <ClipboardCopyIcon className={cn('tm:size-3.5')} />
              {localeService.t('shared-terminal-ui.join-dialog.copy-url')}
            </Button>
          </div>
        </div>
        {cap
          ? (
            <div className={cn('tm:grid tm:grid-cols-[auto_1fr] tm:items-center tm:gap-x-3 tm:gap-y-1 tm:text-xs')}>
              <span className={cn('tm:text-grey-fg')}>{localeService.t('shared-terminal-ui.join-dialog.session-label')}</span>
              <span className={cn('tm:font-mono tm:text-light-grey')}>{cap.sid}</span>
              <span className={cn('tm:text-grey-fg')}>{localeService.t('shared-terminal-ui.join-dialog.role-label')}</span>
              <span>
                <Badge variant="secondary" className={cn('tm:bg-grey-fg/20 tm:text-grey-fg')}>
                  {localeService.t(`shared-terminal-ui.invite-role.${cap.role}`)}
                </Badge>
              </span>
              {expiryDate && (
                <>
                  <span className={cn('tm:text-grey-fg')}>{localeService.t('shared-terminal-ui.join-dialog.expires-label')}</span>
                  <span className={cn('tm:text-light-grey')}>{expiryDate.toLocaleString()}</span>
                </>
              )}
            </div>
          )
          : (
            <div
              className={cn('tm:rounded-md tm:border tm:border-dashed tm:border-line tm:p-3 tm:text-xs tm:text-grey-fg')}
            >
              {localeService.t('shared-terminal-ui.join-dialog.unparsable')}
            </div>
          )}
        <div className={cn('tm:rounded-md tm:border tm:border-yellow/30 tm:bg-yellow/5 tm:p-3 tm:text-xs tm:text-yellow')}>
          {localeService.t('shared-terminal-ui.join-dialog.disabled-hint')}
        </div>
      </div>
    </Dialog>
  );
}

interface IParsedFragment {
  ephPriv?: string;
  capability?: ICapability;
}

function parseInviteUrl(url: string, logService: ILogService): IInvitePayload {
  const payload: IInvitePayload = { rawUrl: url };
  try {
    // Both `termlnk://invite#<frag>` and `https://invite.termlnk.io/s/<id>#<frag>`
    // share the same fragment shape; we only care about the trailing `#...`.
    const hashIdx = url.indexOf('#');
    if (hashIdx >= 0) {
      const fragment = decodeURIComponent(url.slice(hashIdx + 1));
      const parsed = JSON.parse(fragment) as IParsedFragment;
      payload.ephPriv = parsed.ephPriv;
      payload.capability = parsed.capability;
    }
    // Pull a best-effort invite id from `/s/<id>` or `/invite/<id>` path segments
    // so we still show something useful when the fragment is malformed.
    const pathMatch = url.match(/\/(?:s|invite)\/([\w_-]+)/);
    if (pathMatch) {
      payload.inviteId = pathMatch[1];
    }
  } catch (err) {
    logService.error('[ParticipantJoinDialog] parse invite url failed:', err);
  }
  return payload;
}
