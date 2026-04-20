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

import type { Observable } from 'rxjs';
import type { ICreateNotificationParams, INotification, INotificationEvent, INotificationFilter, INotificationStats } from '../../models/notification.model';
import { BehaviorSubject, Subject } from 'rxjs';
import { createIdentifier } from '../../common/di';
import { Disposable, toDisposable } from '../../common/lifecycle';
import { generateRandomId } from '../../common/nanoid';
import { ILogService } from '../log/log.service';

/**
 * Maximum number of notifications to keep in memory
 */
const MAX_NOTIFICATIONS = 100;

export interface INotificationService {
  readonly notifications$: Observable<INotification[]>;
  readonly unreadCount$: Observable<number>;
  readonly isPanelOpen$: Observable<boolean>;
  readonly notificationEvent$: Observable<INotificationEvent>;

  notify(params: ICreateNotificationParams): INotification;
  markAsRead(notificationId: string): void;
  markAllAsRead(): void;
  markGroupAsRead(groupId: string): void;
  remove(notificationId: string): void;
  clearAll(): void;
  clearRead(): void;
  getNotifications(filter?: INotificationFilter): INotification[];
  getNotification(notificationId: string): INotification | undefined;
  getStats(): INotificationStats;
  getUnreadCountForGroup(groupId: string): number;
  openPanel(): void;
  closePanel(): void;
  togglePanel(): void;
}
export const INotificationService = createIdentifier<INotificationService>('core.notification-service');

export class NotificationService extends Disposable implements INotificationService {
  private readonly _notifications$ = new BehaviorSubject<INotification[]>([]);
  readonly notifications$ = this._notifications$.asObservable();

  private readonly _unreadCount$ = new BehaviorSubject<number>(0);
  readonly unreadCount$ = this._unreadCount$.asObservable();

  private readonly _isPanelOpen$ = new BehaviorSubject<boolean>(false);
  readonly isPanelOpen$ = this._isPanelOpen$.asObservable();

  private readonly _notificationEvent$ = new Subject<INotificationEvent>();
  readonly notificationEvent$: Observable<INotificationEvent> = this._notificationEvent$.asObservable();

  constructor(
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    this.disposeWithMe(toDisposable(() => {
      this._notifications$.complete();
      this._unreadCount$.complete();
      this._isPanelOpen$.complete();
      this._notificationEvent$.complete();
    }));
  }

  notify(params: ICreateNotificationParams): INotification {
    const notification: INotification = {
      id: generateRandomId(),
      title: params.title,
      body: params.body ?? '',
      type: params.type ?? 'info',
      source: params.source ?? 'application',
      groupId: params.groupId,
      timestamp: Date.now(),
      read: false,
      priority: params.priority ?? 'normal',
      showDesktop: params.showDesktop ?? true,
      action: params.action,
      metadata: params.metadata,
    };

    const current = this._notifications$.value;
    const updated = [notification, ...current].slice(0, MAX_NOTIFICATIONS);

    this._notifications$.next(updated);
    this._updateUnreadCount();

    this._notificationEvent$.next({ type: 'added', notification });

    // Show desktop notification if enabled and appropriate
    if (notification.showDesktop && this._shouldShowDesktop(notification)) {
      this._showDesktopNotification(notification);
    }

    return notification;
  }

  markAsRead(notificationId: string): void {
    this._updateNotifications((n) => n.id === notificationId ? { ...n, read: true } : n);
    this._notificationEvent$.next({ type: 'updated', notificationId });
  }

  markAllAsRead(): void {
    this._updateNotifications((n) => ({ ...n, read: true }));
    this._notificationEvent$.next({ type: 'updated' });
  }

  markGroupAsRead(groupId: string): void {
    this._updateNotifications((n) => n.groupId === groupId ? { ...n, read: true } : n);
    this._notificationEvent$.next({ type: 'updated' });
  }

  remove(notificationId: string): void {
    const updated = this._notifications$.value.filter((n) => n.id !== notificationId);
    this._notifications$.next(updated);
    this._updateUnreadCount();
    this._notificationEvent$.next({ type: 'removed', notificationId });
  }

  clearAll(): void {
    this._notifications$.next([]);
    this._unreadCount$.next(0);
    this._notificationEvent$.next({ type: 'cleared' });
  }

  clearRead(): void {
    const updated = this._notifications$.value.filter((n) => !n.read);
    this._notifications$.next(updated);
    this._notificationEvent$.next({ type: 'cleared' });
  }

  getNotifications(filter?: INotificationFilter): INotification[] {
    if (!filter) {
      return [...this._notifications$.value];
    }

    const sources = filter.source
      ? (Array.isArray(filter.source) ? filter.source : [filter.source])
      : null;
    const types = filter.type
      ? (Array.isArray(filter.type) ? filter.type : [filter.type])
      : null;

    return this._notifications$.value.filter((n) => {
      if (sources && !sources.includes(n.source)) return false;
      if (types && !types.includes(n.type)) return false;
      if (filter.read !== undefined && n.read !== filter.read) return false;
      if (filter.groupId && n.groupId !== filter.groupId) return false;
      if (filter.startTime && n.timestamp < filter.startTime) return false;
      if (filter.endTime && n.timestamp > filter.endTime) return false;
      return true;
    });
  }

  getNotification(notificationId: string): INotification | undefined {
    return this._notifications$.value.find((n) => n.id === notificationId);
  }

  getStats(): INotificationStats {
    const notifications = this._notifications$.value;

    const countBy = <K extends string>(key: keyof INotification): Record<K, number> => {
      const result = {} as Record<K, number>;
      for (const n of notifications) {
        const value = n[key] as K;
        result[value] = (result[value] ?? 0) + 1;
      }
      return result;
    };

    return {
      total: notifications.length,
      unread: notifications.filter((n) => !n.read).length,
      bySource: countBy('source'),
      byType: countBy('type'),
    };
  }

  getUnreadCountForGroup(groupId: string): number {
    return this._notifications$.value.filter((n) => n.groupId === groupId && !n.read).length;
  }

  openPanel(): void {
    this._isPanelOpen$.next(true);
  }

  closePanel(): void {
    this._isPanelOpen$.next(false);
  }

  togglePanel(): void {
    this._isPanelOpen$.next(!this._isPanelOpen$.value);
  }

  private _updateUnreadCount(): void {
    const count = this._notifications$.value.filter((n) => !n.read).length;
    this._unreadCount$.next(count);
  }

  private _updateNotifications(
    updater: (notification: INotification) => INotification
  ): void {
    this._notifications$.next(this._notifications$.value.map(updater));
    this._updateUnreadCount();
  }

  private _shouldShowDesktop(notification: INotification): boolean {
    // Don't show desktop notification for low priority
    if (notification.priority === 'low') {
      return false;
    }

    // Don't show if notification panel is open
    if (this._isPanelOpen$.value) {
      return false;
    }

    return true;
  }

  private _showDesktopNotification(notification: INotification): void {
    // Check if running in Electron environment with desktop notification support
    if (typeof window !== 'undefined' && 'Notification' in window) {
      // Browser notification API
      if (Notification.permission === 'granted') {
        const desktopNotif = new Notification(notification.title, {
          body: notification.body,
          icon: '/icon.png', // Default icon path
          tag: notification.id,
        });

        desktopNotif.onclick = () => {
          this._handleNotificationClick(notification);
        };
      }
    }
  }

  private _handleNotificationClick(notification: INotification): void {
    this.markAsRead(notification.id);

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
        case 'command':
          // Command execution will be handled by the UI layer
          // through the notification click event
          break;
      }
    }

    this.openPanel();
  }
}
