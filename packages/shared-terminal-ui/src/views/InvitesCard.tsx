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

import type { CollabInviteStatus, IInviteTokenState } from '@termlnk/shared-terminal';
import { ILogService, LocaleService, Quantity } from '@termlnk/core';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, cn, useDependency, useObservable } from '@termlnk/design';
import { IPairingService, SharedTerminalRole } from '@termlnk/shared-terminal';
import { LinkIcon, TicketIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';

/**
 * Outstanding + history invite cards (P5.5.7).
 *
 * "Outstanding" lists every still-redeemable invite; revoke button is the primary
 * action. "History" shows the audit trail (consumed / revoked / expired) so the
 * owner can audit who used what and when. Both views are reactive on
 * IPairingService.outstandingInvites$ / inviteHistory$, so they update in real time
 * when create / revoke / consume / expiry-sweep land.
 */
export function OutstandingInvitesCard(): React.JSX.Element {
  const localeService = useDependency(LocaleService);
  const logService = useDependency(ILogService);
  const pairing = useDependency(IPairingService, Quantity.OPTIONAL);
  const outstanding = useObservable<readonly IInviteTokenState[]>(pairing?.outstandingInvites$ ?? null, []);
  const [busy, setBusy] = useState<string | null>(null);

  const handleRevoke = async (inviteId: string): Promise<void> => {
    if (!pairing) {
      return;
    }
    setBusy(inviteId);
    try {
      await pairing.revokeInvite(inviteId);
    } catch (err) {
      logService.error('[OutstandingInvitesCard] revoke failed:', err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className={cn('tm:bg-one-bg')}>
      <CardHeader>
        <CardTitle className={cn('tm:flex tm:items-center tm:gap-2')}>
          <TicketIcon className={cn('tm:size-4 tm:text-blue')} />
          {localeService.t('shared-terminal-ui.outstanding-invites.title')}
        </CardTitle>
        <CardDescription>
          {localeService.t('shared-terminal-ui.outstanding-invites.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className={cn('tm:flex tm:flex-col tm:gap-2')}>
        {!pairing && (
          <div className={cn('tm:rounded-md tm:border tm:border-dashed tm:border-line tm:p-4 tm:text-sm tm:text-grey-fg')}>
            {localeService.t('shared-terminal-ui.outstanding-invites.unavailable')}
          </div>
        )}
        {pairing && outstanding.length === 0 && (
          <div className={cn('tm:rounded-md tm:border tm:border-dashed tm:border-line tm:p-4 tm:text-sm tm:text-grey-fg')}>
            {localeService.t('shared-terminal-ui.outstanding-invites.empty')}
          </div>
        )}
        {outstanding.map((invite) => (
          <InviteRow
            key={invite.inviteId}
            invite={invite}
            showRevoke
            busy={busy === invite.inviteId}
            onRevoke={() => handleRevoke(invite.inviteId)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

export function InviteHistoryCard(): React.JSX.Element {
  const localeService = useDependency(LocaleService);
  const pairing = useDependency(IPairingService, Quantity.OPTIONAL);
  const all = useObservable<readonly IInviteTokenState[]>(pairing?.inviteHistory$ ?? null, []);

  const history = [...all].filter((invite) => invite.status !== 'active').sort((a, b) => b.createdAt - a.createdAt);

  return (
    <Card className={cn('tm:bg-one-bg')}>
      <CardHeader>
        <CardTitle className={cn('tm:flex tm:items-center tm:gap-2')}>
          <LinkIcon className={cn('tm:size-4 tm:text-grey-fg')} />
          {localeService.t('shared-terminal-ui.invite-history.title')}
        </CardTitle>
        <CardDescription>
          {localeService.t('shared-terminal-ui.invite-history.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className={cn('tm:flex tm:flex-col tm:gap-2')}>
        {!pairing && (
          <div className={cn('tm:rounded-md tm:border tm:border-dashed tm:border-line tm:p-4 tm:text-sm tm:text-grey-fg')}>
            {localeService.t('shared-terminal-ui.outstanding-invites.unavailable')}
          </div>
        )}
        {pairing && history.length === 0 && (
          <div className={cn('tm:rounded-md tm:border tm:border-dashed tm:border-line tm:p-4 tm:text-sm tm:text-grey-fg')}>
            {localeService.t('shared-terminal-ui.invite-history.empty')}
          </div>
        )}
        {history.map((invite) => (
          <InviteRow key={invite.inviteId} invite={invite} />
        ))}
      </CardContent>
    </Card>
  );
}

interface IInviteRowProps {
  invite: IInviteTokenState;
  showRevoke?: boolean;
  busy?: boolean;
  onRevoke?: () => void;
}

function InviteRow(props: IInviteRowProps): React.JSX.Element {
  const localeService = useDependency(LocaleService);
  const { invite, showRevoke, busy, onRevoke } = props;
  const expiryLabel = formatExpiry(invite, localeService);
  return (
    <div
      className={cn(`
        tm:grid tm:grid-cols-[1fr_auto] tm:items-center tm:gap-3 tm:rounded-md tm:border tm:border-line
        tm:bg-black tm:px-3 tm:py-2
      `)}
    >
      <div className={cn('tm:flex tm:min-w-0 tm:flex-col tm:gap-1')}>
        <div className={cn('tm:flex tm:flex-wrap tm:items-center tm:gap-2')}>
          <span className={cn('tm:truncate tm:font-mono tm:text-xs tm:text-light-grey')}>{invite.inviteId.slice(0, 16)}…</span>
          {renderStatusBadge(invite.status, localeService)}
          {renderRoleBadge(invite.role, localeService)}
          {invite.singleUse && (
            <Badge variant="secondary" className={cn('tm:bg-blue/10 tm:text-blue')}>
              {localeService.t('shared-terminal-ui.invite-row.single-use')}
            </Badge>
          )}
        </div>
        <div
          className={cn(`
            tm:flex tm:flex-wrap tm:items-center tm:gap-x-3 tm:gap-y-0.5 tm:text-xs tm:text-grey-fg
          `)}
        >
          <span>{localeService.t('shared-terminal-ui.invite-row.session', invite.sessionId)}</span>
          <span>{expiryLabel}</span>
          {invite.note && <span title={invite.note}>{invite.note}</span>}
        </div>
      </div>
      {showRevoke && onRevoke && (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={onRevoke}
          className={cn('tm:gap-1.5')}
        >
          <Trash2Icon className={cn('tm:size-3.5')} />
          {localeService.t('shared-terminal-ui.invite-row.revoke')}
        </Button>
      )}
    </div>
  );
}

function renderStatusBadge(status: CollabInviteStatus, localeService: { t: (key: string) => string }): React.JSX.Element {
  return (
    <Badge
      variant="secondary"
      className={cn({
        'tm:bg-green/10 tm:text-green': status === 'active',
        'tm:bg-blue/10 tm:text-blue': status === 'consumed',
        'tm:bg-yellow/10 tm:text-yellow': status === 'expired',
        'tm:bg-red/10 tm:text-red': status === 'revoked',
      })}
    >
      {localeService.t(`shared-terminal-ui.invite-status.${status}`)}
    </Badge>
  );
}

function renderRoleBadge(role: SharedTerminalRole, localeService: { t: (key: string) => string }): React.JSX.Element {
  return (
    <Badge variant="secondary" className={cn('tm:bg-grey-fg/20 tm:text-grey-fg')}>
      {localeService.t(`shared-terminal-ui.invite-role.${role}`)}
    </Badge>
  );
}

function formatExpiry(invite: IInviteTokenState, localeService: { t: (key: string, ...args: string[]) => string }): string {
  if (invite.status === 'consumed' && invite.consumedAt) {
    return localeService.t('shared-terminal-ui.invite-row.consumed-at', new Date(invite.consumedAt).toLocaleString());
  }
  if (invite.status === 'revoked' && invite.revokedAt) {
    return localeService.t('shared-terminal-ui.invite-row.revoked-at', new Date(invite.revokedAt).toLocaleString());
  }
  if (invite.status === 'expired') {
    return localeService.t('shared-terminal-ui.invite-row.expired-at', new Date(invite.exp).toLocaleString());
  }
  return localeService.t('shared-terminal-ui.invite-row.expires-at', new Date(invite.exp).toLocaleString());
}
