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
import { IAuthService } from '@termlnk/auth';
import { ICommandService, Quantity } from '@termlnk/core';
import { Avatar, AvatarFallback, AvatarImage, cn, useDependency, useObservable } from '@termlnk/design';
import { TooltipWrapper } from '@termlnk/ui';
import { UserRoundIcon } from 'lucide-react';
import { ToggleAccountDialogCommand } from '../commands/toggle-account-dialog.command';

export function AccountButton() {
  const commandService = useDependency(ICommandService);
  // OPTIONAL: cloud service may be unconfigured; the button still opens the dialog,
  // which then renders AuthGate's "unavailable" placeholder.
  const authClient = useDependency(IAuthService, Quantity.OPTIONAL);

  const currentUser = useObservable<IUserAccount | null>(
    authClient?.currentUser$ ?? null,
    null
  );

  const openAccountDialog = () => commandService.executeCommand(ToggleAccountDialogCommand.id);

  const displayName = currentUser?.displayName?.trim().length
    ? currentUser.displayName
    : currentUser?.email.split('@')[0] ?? currentUser?.email ?? '';
  const avatarFallback = displayName.charAt(0).toUpperCase();

  const tooltipLabelKey = currentUser
    ? 'auth-ui.account-dialog.tooltip-account'
    : 'auth-ui.account-dialog.tooltip-login';

  return (
    <TooltipWrapper
      side="right"
      commandId={ToggleAccountDialogCommand.id}
      labelKey={tooltipLabelKey}
    >
      <div
        className={`
          tm:grid tm:h-[2.8rem] tm:w-full tm:cursor-pointer tm:grid-cols-[2px_1fr_2px] tm:items-center
          tm:overflow-hidden tm:text-center
          tm:hover:text-white
        `}
        onClick={openAccountDialog}
      >
        <span aria-hidden />
        <span className="tm:flex tm:items-center tm:justify-center">
          {currentUser
            ? (
              <Avatar className={cn('tm:size-[1.6rem]')}>
                {currentUser.avatarUrl && <AvatarImage src={currentUser.avatarUrl} alt={displayName} />}
                <AvatarFallback className={cn('tm:text-[0.65rem]')}>{avatarFallback}</AvatarFallback>
              </Avatar>
            )
            : <UserRoundIcon size="1.2rem" />}
        </span>
        <span aria-hidden />
      </div>
    </TooltipWrapper>
  );
}
