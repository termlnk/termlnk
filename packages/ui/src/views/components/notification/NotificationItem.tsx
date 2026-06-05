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
import type { MouseEvent } from 'react';
import { Badge, Button, cn } from '@termlnk/design';
import { Check, Trash2 } from 'lucide-react';
import { useCallback } from 'react';
import { getNotificationIcon, getSourceLabel } from './notification-utils';
import { formatRelativeTime } from './time-formatter';

interface INotificationItemProps {
  notification: INotification;
  onRead: (id: string) => void;
  onRemove: (id: string) => void;
  onClick: (notification: INotification) => void;
  t: (key: string, ...args: string[]) => string;
  dateLocale: string;
}

export function NotificationItem(props: INotificationItemProps) {
  const { notification, onRead, onRemove, onClick, t, dateLocale } = props;
  const handleClick = useCallback(() => {
    onClick(notification);
  }, [notification, onClick]);

  const handleRead = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onRead(notification.id);
    },
    [notification.id, onRead]
  );

  const handleRemove = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onRemove(notification.id);
    },
    [notification.id, onRemove]
  );

  const isRead = notification.read;

  return (
    <div
      onClick={handleClick}
      className={cn(
        `
          tm:group
          tm:flex tm:animate-in tm:gap-2 tm:rounded-md tm:border tm:border-line tm:p-2 tm:transition-all tm:duration-150
          tm:fade-in-0 tm:slide-in-from-top-1
        `,
        {
          'tm:hover:border-line tm:hover:bg-one-bg': isRead,
          'tm:hover:bg-one-bg': !isRead,
        }
      )}
    >
      <div className="tm:flex tm:shrink-0 tm:pt-0.5">
        {getNotificationIcon(notification.type)}
      </div>

      <div className="tm:flex tm:min-w-0 tm:flex-1 tm:flex-col tm:gap-0.5 tm:select-text">
        <div className="tm:flex tm:items-start tm:justify-between tm:gap-2">
          <div className="tm:flex tm:min-w-0 tm:items-center tm:gap-1">
            <span
              className={cn(
                'tm:truncate tm:text-[11px] tm:font-medium',
                {
                  'tm:text-light-grey': isRead,
                  'tm:text-white': !isRead,
                }
              )}
            >
              {notification.title}
            </span>
          </div>

        </div>

        {notification.body && (
          <p className="tm:line-clamp-1 tm:text-[11px]/4 tm:text-light-grey">
            {notification.body}
          </p>
        )}

        <div className="tm:flex tm:gap-2">
          <div className="tm:shrink-0 tm:text-[10px] tm:text-light-grey">
            {formatRelativeTime(notification.timestamp, t, dateLocale)}
          </div>
          {notification.source && (
            <Badge
              variant="outline"
              className={cn(`
                tm:border tm:border-line/80 tm:bg-one-bg/60 tm:px-1.5 tm:py-0.5 tm:text-[10px] tm:leading-none
                tm:text-light-grey
              `)}
            >
              {getSourceLabel(notification.source, t)}
            </Badge>
          )}
        </div>
      </div>

      <div
        className={`
          tm:flex tm:shrink-0 tm:items-start tm:gap-0.5 tm:opacity-0 tm:transition-opacity tm:duration-150
          tm:group-hover:opacity-100
        `}
      >
        {!isRead && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="tm:hover:bg-one-bg2"
            onClick={handleRead}
            title={t('ui.notification-panel.actions.mark-read-title')}
          >
            <Check className="tm:size-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleRemove}
          className="tm:hover:bg-red/10 tm:hover:text-red"
          title={t('ui.notification-panel.actions.remove-title')}
        >
          <Trash2 className="tm:size-3" />
        </Button>
      </div>
    </div>
  );
}
