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
import type { INotifyService } from '@termlnk/rpc';
import type { Observable } from 'rxjs';
import { Disposable, INotificationService } from '@termlnk/core';

/**
 * Server-side RPC notification bus.
 * Wraps Core's INotificationService and exposes its observables for tRPC streaming.
 */
export class NotifyService extends Disposable implements INotifyService {
  constructor(
    @INotificationService private readonly _notificationService: INotificationService
  ) {
    super();
  }

  get notificationEvent$(): Observable<INotificationEvent> {
    return this._notificationService.notificationEvent$;
  }

  get notifications$(): Observable<INotification[]> {
    return this._notificationService.notifications$;
  }

  get unreadCount$(): Observable<number> {
    return this._notificationService.unreadCount$;
  }

  notify(params: ICreateNotificationParams): INotification {
    return this._notificationService.notify(params);
  }

  markAsRead(id: string): void {
    this._notificationService.markAsRead(id);
  }

  markAllAsRead(): void {
    this._notificationService.markAllAsRead();
  }

  markGroupAsRead(groupId: string): void {
    this._notificationService.markGroupAsRead(groupId);
  }

  remove(id: string): void {
    this._notificationService.remove(id);
  }

  clearAll(): void {
    this._notificationService.clearAll();
  }

  clearRead(): void {
    this._notificationService.clearRead();
  }

  getNotifications(filter?: INotificationFilter): INotification[] {
    return this._notificationService.getNotifications(filter);
  }

  getStats(): INotificationStats {
    return this._notificationService.getStats();
  }
}
