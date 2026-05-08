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
import { Avatar, AvatarFallback, AvatarImage, Badge, Button, cn, useDependency } from '@termlnk/design';
import { LogOutIcon, MailCheckIcon, MailWarningIcon } from 'lucide-react';

export interface IAccountPanelProps {
  readonly user: IUserAccount;
  readonly onLogout: () => Promise<void> | void;
  readonly busy?: boolean;
}

/**
 * 已登录账号面板——展示账号信息 + 登出按钮。
 *
 * 不展示的字段（设计选择）：
 * - userId：内部 UUID，用户感知不到价值
 * - createdAt / updatedAt：时间戳放到详情页才有意义
 *
 * 显示名优先级：displayName → email 前缀。
 */
export function AccountPanel(props: IAccountPanelProps) {
  const localeService = useDependency(LocaleService);
  const { user, onLogout, busy } = props;

  const displayName = user.displayName?.trim().length
    ? user.displayName
    : user.email.split('@')[0] ?? user.email;

  const avatarFallback = displayName.charAt(0).toUpperCase();

  return (
    <div className={cn('tm:flex tm:flex-col tm:gap-4 tm:p-1')}>
      <div className={cn('tm:flex tm:items-center tm:gap-4')}>
        <Avatar className={cn('tm:size-12')}>
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={displayName} />}
          <AvatarFallback>{avatarFallback}</AvatarFallback>
        </Avatar>
        <div className={cn('tm:flex tm:flex-col tm:gap-1 tm:overflow-hidden')}>
          <div className={cn('tm:truncate tm:text-base tm:font-semibold tm:text-light-grey')}>
            {displayName}
          </div>
          <div className={cn('tm:truncate tm:text-sm tm:text-grey-fg')}>
            {user.email}
          </div>
        </div>
      </div>

      <div className={cn('tm:flex tm:flex-wrap tm:items-center tm:gap-2')}>
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

      <div className={cn('tm:flex tm:flex-col tm:gap-2 tm:pt-2')}>
        <Button
          variant="outline"
          onClick={() => {
            void onLogout();
          }}
          disabled={busy}
          className={cn('tm:w-full tm:gap-2')}
        >
          <LogOutIcon className={cn('tm:size-4')} />
          {busy
            ? localeService.t('auth-ui.account.logging-out')
            : localeService.t('auth-ui.account.logout')}
        </Button>
      </div>
    </div>
  );
}
