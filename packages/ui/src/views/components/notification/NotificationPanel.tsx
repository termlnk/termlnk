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

import type { INotification } from '@termlnk/core';
import { INotificationService, LocaleService, LocaleType } from '@termlnk/core';
import { Button, cn, useDependency, useObservable } from '@termlnk/design';
import { CheckCheck, Filter, Trash2, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { EmptyState } from './EmptyState';
import { NotificationItem } from './NotificationItem';

export function NotificationPanel() {
  const notificationService = useDependency(INotificationService);
  const localeService = useDependency(LocaleService);
  const notifications = useObservable(notificationService.notifications$, []);
  const unreadCount = useObservable(notificationService.unreadCount$, 0);
  const currentLocale = useObservable(localeService.currentLocale$, localeService.getCurrentLocale());

  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const dateLocale = currentLocale === LocaleType.ZH_CN ? 'zh-CN' : 'en-US';

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') {
      return notifications.filter((n: INotification) => !n.read);
    }
    return notifications;
  }, [notifications, filter]);

  const handleMarkAllRead = useCallback(() => {
    notificationService.markAllAsRead();
  }, [notificationService]);

  const handleClearAll = useCallback(() => {
    notificationService.clearAll();
  }, [notificationService]);

  const handleMarkAsRead = useCallback(
    (id: string) => {
      notificationService.markAsRead(id);
    },
    [notificationService]
  );

  const handleRemove = useCallback(
    (id: string) => {
      notificationService.remove(id);
    },
    [notificationService]
  );

  const handleClick = useCallback(
    (notification: INotification) => {
      notificationService.markAsRead(notification.id);
      // Execute action if exists
      if (notification.action) {
        switch (notification.action.type) {
          case 'callback':
            notification.action.callback?.();
            break;
          case 'url':
            if (notification.action.url) {
              window.open(notification.action.url, '_blank');
            }
            break;
        }
      }
    },
    [notificationService]
  );

  const toggleFilter = useCallback(() => {
    setFilter((prev) => (prev === 'all' ? 'unread' : 'all'));
  }, []);

  const t = localeService.t;

  return (
    <div className="tm:flex tm:h-full tm:flex-col tm:bg-black tm:text-light-grey">
      {/* Header */}
      <div
        className={`
          tm:flex tm:h-7.5 tm:items-center tm:justify-between tm:border-b tm:border-line tm:bg-statusline-bg tm:px-3
          tm:py-0 tm:text-[10px] tm:text-white tm:select-none
        `}
      >
        <div className="tm:flex tm:items-center tm:gap-2">
          <span className="tm:font-medium">{t('ui.notification-panel.title')}</span>
          {unreadCount > 0 && (
            <span
              className={`
                tm:flex tm:h-4 tm:min-w-4 tm:items-center tm:justify-center tm:rounded-full tm:bg-red tm:px-1
                tm:text-[10px] tm:leading-none tm:font-medium tm:text-[#fff]
              `}
            >
              {unreadCount}
            </span>
          )}
        </div>

        <div className="tm:flex tm:items-center tm:gap-0.5">
          <FilterButton active={filter === 'unread'} onClick={toggleFilter} t={t} />
          {unreadCount > 0 && <MarkAllReadButton onClick={handleMarkAllRead} t={t} />}
          {notifications.length > 0 && <ClearAllButton onClick={handleClearAll} t={t} />}
          <CloseButton onClick={() => notificationService.closePanel()} />
        </div>
      </div>

      {/* Notification list */}
      <div className="tm:flex-1 tm:overflow-y-auto tm:bg-black tm:p-2">
        {filteredNotifications.length === 0
          ? (
            <EmptyState t={t} />
          )
          : (
            <div className="tm:flex tm:flex-col tm:gap-1">
              {filteredNotifications.map((notification: INotification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={handleMarkAsRead}
                  onRemove={handleRemove}
                  onClick={handleClick}
                  t={t}
                  dateLocale={dateLocale}
                />
              ))}
            </div>
          )}
      </div>

      {/* Footer stats */}
      {notifications.length > 0 && (
        <div className="tm:border-t tm:border-line tm:bg-black tm:px-4 tm:py-2 tm:text-xs tm:text-grey-fg">
          {unreadCount > 0
            ? t('ui.notification-panel.footer.total-with-unread', String(notifications.length), String(unreadCount))
            : t('ui.notification-panel.footer.total', String(notifications.length))}
        </div>
      )}
    </div>
  );
}

// Header button components
interface IFilterButtonProps {
  active: boolean;
  onClick: () => void;
  t: (key: string, ...args: string[]) => string;
}

function FilterButton({ active, onClick, t }: IFilterButtonProps) {
  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={onClick}
      className={cn('tm:text-[10px]', {
        'tm:bg-blue tm:text-[#fff] tm:hover:bg-blue tm:hover:text-[#fff]': active,
      })}
    >
      <Filter />
      {active ? t('ui.notification-panel.filter.unread') : t('ui.notification-panel.filter.all')}
    </Button>
  );
}

interface IMarkAllReadButtonProps {
  onClick: () => void;
  t: (key: string, ...args: string[]) => string;
}

function MarkAllReadButton({ onClick, t }: IMarkAllReadButtonProps) {
  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={onClick}
      className={cn('tm:text-[10px]')}
      title={t('ui.notification-panel.actions.mark-all-read-title')}
    >
      <CheckCheck />
      <span>{t('ui.notification-panel.actions.mark-all-read')}</span>
    </Button>
  );
}

interface IClearAllButtonProps {
  onClick: () => void;
  t: (key: string, ...args: string[]) => string;
}

function ClearAllButton({ onClick, t }: IClearAllButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={onClick}
      title={t('ui.notification-panel.actions.clear-all-title')}
    >
      <Trash2 />
    </Button>
  );
}

interface ICloseButtonProps {
  onClick: () => void;
}

function CloseButton({ onClick }: ICloseButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={onClick}
    >
      <X />
    </Button>
  );
}
