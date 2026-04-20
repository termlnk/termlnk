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

import { INotificationService, LocaleService } from '@termlnk/core';
import { Button, useDependency, useObservable } from '@termlnk/design';
import { Bell, BellRing } from 'lucide-react';
import { useCallback } from 'react';

export function NotificationIcon() {
  const notificationService = useDependency(INotificationService);
  const localeService = useDependency(LocaleService);
  const unreadCount = useObservable(notificationService.unreadCount$, 0);
  const isPanelOpen = useObservable(notificationService.isPanelOpen$, false);

  const handleClick = useCallback(() => {
    notificationService.togglePanel();
  }, [notificationService]);

  const hasUnread = unreadCount > 0;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleClick}
      data-notification-trigger="true"
      className="tm:relative"
      title={hasUnread
        ? localeService.t('ui.notification-icon.unread-title', String(unreadCount))
        : localeService.t('ui.notification-icon.title')}
    >
      {hasUnread
        ? (
          <BellRing size={14} strokeWidth={1.5} className="tm:text-yellow" />
        )
        : (
          <Bell size={14} strokeWidth={1.5} className="tm:text-white" />
        )}

      {hasUnread && (
        <span
          className={`
            tm:absolute tm:top-0 tm:right-0.5 tm:flex tm:h-3 tm:min-w-3 tm:items-center tm:justify-center
            tm:rounded-full tm:bg-red tm:px-0.5 tm:text-[8px] tm:leading-none tm:text-[#fff]
          `}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}

      {isPanelOpen && (
        <span
          className="
            tm:absolute tm:-bottom-px tm:left-1/2 tm:size-1 tm:-translate-x-1/2 tm:rounded-full tm:bg-nord-blue
          "
        />
      )}
    </Button>
  );
}
