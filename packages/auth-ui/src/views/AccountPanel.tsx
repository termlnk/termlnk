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
import { LocaleService } from '@termlnk/core';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useDependency,
} from '@termlnk/design';
import { Loader2Icon, LogOutIcon, MailCheckIcon, MailWarningIcon } from 'lucide-react';

export interface IAccountPanelProps {
  readonly user: IUserAccount;
  readonly onLogout: () => Promise<void> | void;
  readonly busy?: boolean;
}

export function AccountPanel(props: IAccountPanelProps) {
  const localeService = useDependency(LocaleService);
  const { user, onLogout, busy } = props;

  const displayName = user.displayName?.trim().length
    ? user.displayName
    : user.email.split('@')[0] ?? user.email;

  const avatarFallback = displayName.charAt(0).toUpperCase();
  const joinedAt = formatJoinedAt(user.createdAt);

  return (
    <div className={cn('tm:flex tm:flex-col tm:gap-3')}>
      <div className={cn('tm:flex tm:items-start tm:gap-4')}>
        <Avatar className={cn('tm:size-12 tm:shrink-0 tm:ring-1 tm:ring-line/70')}>
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={displayName} />}
          <AvatarFallback className={cn('tm:bg-one-bg2 tm:text-base tm:font-semibold tm:text-light-grey')}>
            {avatarFallback}
          </AvatarFallback>
        </Avatar>

        <div className={cn('tm:flex tm:min-w-0 tm:flex-1 tm:flex-col tm:gap-1')}>
          <span className={cn('tm:truncate tm:text-base tm:font-semibold tm:text-white')}>
            {displayName}
          </span>
          <span className={cn('tm:truncate tm:text-sm tm:text-grey-fg')}>
            {user.email}
          </span>
          <div className={cn('tm:mt-1')}>
            {user.emailVerified
              ? (
                <Badge variant="secondary" className={cn('tm:gap-1.5 tm:bg-green/10 tm:text-green')}>
                  <MailCheckIcon className={cn('tm:size-3')} />
                  {localeService.t('auth-ui.account.email-verified')}
                </Badge>
              )
              : (
                <Badge variant="secondary" className={cn('tm:gap-1.5 tm:bg-yellow/10 tm:text-yellow')}>
                  <MailWarningIcon className={cn('tm:size-3')} />
                  {localeService.t('auth-ui.account.email-unverified')}
                </Badge>
              )}
          </div>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                void onLogout();
              }}
              disabled={busy}
              aria-label={localeService.t('auth-ui.account.logout')}
              className={cn(`
                tm:-mt-1 tm:-mr-1 tm:shrink-0 tm:text-grey-fg
                tm:hover:bg-red/10 tm:hover:text-red
              `)}
            >
              {busy
                ? <Loader2Icon className={cn('tm:size-4 tm:animate-spin')} />
                : <LogOutIcon className={cn('tm:size-4')} />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {busy
              ? localeService.t('auth-ui.account.logging-out')
              : localeService.t('auth-ui.account.logout')}
          </TooltipContent>
        </Tooltip>
      </div>

      {joinedAt && (
        <span className={cn('tm:pl-16 tm:text-xs tm:text-grey-fg')}>
          {localeService.t('auth-ui.account.joined-at', joinedAt)}
        </span>
      )}
    </div>
  );
}

function formatJoinedAt(createdAt: string): string | null {
  const ms = Date.parse(createdAt);
  if (Number.isNaN(ms)) {
    return null;
  }
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
