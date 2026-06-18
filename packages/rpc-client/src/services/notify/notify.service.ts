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
import { Disposable, INotificationService, toDisposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { IRPCClientService } from '../rpc-client.service';

/**
 * Client-side RPC notification bus.
 * Subscribes to tRPC notification streams and forwards to Core's INotificationService.
 */
export class NotifyService extends Disposable implements INotifyService {
  notifications$: Observable<INotification[]>;
  unreadCount$: Observable<number>;
  notificationEvent$: Observable<INotificationEvent>;

  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService,
    @INotificationService private readonly _notificationService: INotificationService
  ) {
    super();

    this.notifications$ = this._notificationService.notifications$;
    this.unreadCount$ = this._notificationService.unreadCount$;
    this.notificationEvent$ = this._notificationService.notificationEvent$;

    this._subscribeToServerEvents();
  }

  private get _client() {
    return this._rpcClientService.getClient().notify;
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

  /**
   * Subscribe to server-side notification events via tRPC.
   * Forwards received notifications to Core's INotificationService for UI display.
   */
  private _subscribeToServerEvents(): void {
    const serverEvent$ = trpcSubscriptionToObservable<INotificationEvent>(
      (opts) => this._client.event$.subscribe(undefined, opts)
    );

    this.disposeWithMe(toDisposable(
      serverEvent$.subscribe((event) => {
        switch (event.type) {
          case 'transient':
          case 'added': {
            if (event.notification) {
              const n = event.notification;
              this._notificationService.notify({
                title: n.title,
                body: n.body,
                type: n.type,
                source: n.source,
                groupId: n.groupId,
                priority: n.priority,
                showDesktop: n.showDesktop,
                transient: n.transient,
                action: n.action,
                metadata: n.metadata,
              });
            }
            break;
          }
          case 'updated': {
            if (event.notificationId) {
              this._notificationService.markAsRead(event.notificationId);
            } else {
              this._notificationService.markAllAsRead();
            }
            break;
          }
          case 'removed': {
            if (event.notificationId) {
              this._notificationService.remove(event.notificationId);
            }
            break;
          }
          case 'cleared': {
            this._notificationService.clearAll();
            break;
          }
        }
      })
    ));
  }
}
