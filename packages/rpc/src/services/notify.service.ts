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

import type { ICreateNotificationParams, INotification, INotificationEvent, INotificationFilter, INotificationStats } from '@termlnk/core';
import type { Observable } from 'rxjs';
import { createIdentifier } from '@termlnk/core';

/**
 * RPC notification bus service.
 *
 * Server side: wraps Core's INotificationService, exposes observables for tRPC streaming.
 * Client side: subscribes to tRPC streams, forwards notifications to Core's INotificationService.
 */
export interface INotifyService {
  /** Stream of notification events (for tRPC subscription) */
  readonly notificationEvent$: Observable<INotificationEvent>;

  /** Stream of all current notifications */
  readonly notifications$: Observable<INotification[]>;

  /** Stream of unread count */
  readonly unreadCount$: Observable<number>;

  /** Create a notification */
  notify(params: ICreateNotificationParams): INotification;

  /** Mark a notification as read */
  markAsRead(id: string): void;

  /** Mark all notifications as read */
  markAllAsRead(): void;

  /** Mark all notifications in a group as read */
  markGroupAsRead(groupId: string): void;

  /** Remove a notification */
  remove(id: string): void;

  /** Clear all notifications */
  clearAll(): void;

  /** Clear read notifications */
  clearRead(): void;

  /** Get notifications with optional filter */
  getNotifications(filter?: INotificationFilter): INotification[];

  /** Get notification statistics */
  getStats(): INotificationStats;
}

export const INotifyService = createIdentifier<INotifyService>('rpc.notify-service');
