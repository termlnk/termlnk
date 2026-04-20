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

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationSource = 'terminal' | 'system' | 'extension' | 'application' | 'agent';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface INotification {
  /** Unique identifier */
  readonly id: string;

  /** Notification title */
  readonly title: string;

  /** Notification body/content */
  readonly body: string;

  /** Notification type */
  readonly type: NotificationType;

  /** Source of the notification */
  readonly source: NotificationSource;

  /** Associated session/group ID (e.g., terminal session ID) */
  readonly groupId?: string;

  /** Timestamp when notification was created */
  readonly timestamp: number;

  /** Whether the notification has been read */
  read: boolean;

  /** Priority level */
  readonly priority: NotificationPriority;

  /** Whether to show desktop notification */
  readonly showDesktop: boolean;

  /** Optional action to execute when notification is clicked */
  readonly action?: INotificationAction;

  /** Optional metadata for extensibility */
  readonly metadata?: Record<string, unknown>;
}

export interface INotificationAction {
  type: 'command' | 'callback' | 'url';
  commandId?: string;
  params?: Record<string, unknown>;
  url?: string;
  callback?: () => void;
}

export interface ICreateNotificationParams {
  /** Notification title (required) */
  title: string;

  /** Notification body/content (optional, defaults to empty) */
  body?: string;

  /** Notification type (optional, defaults to 'info') */
  type?: NotificationType;

  /** Source of the notification (optional, defaults to 'application') */
  source?: NotificationSource;

  /** Associated session/group ID (optional) */
  groupId?: string;

  /** Priority level (optional, defaults to 'normal') */
  priority?: NotificationPriority;

  /** Whether to show desktop notification (optional, defaults to true) */
  showDesktop?: boolean;

  /** Optional action to execute when notification is clicked */
  action?: INotificationAction;

  /** Optional metadata for extensibility */
  metadata?: Record<string, unknown>;
}

export interface INotificationFilter {
  source?: NotificationSource | NotificationSource[];
  type?: NotificationType | NotificationType[];
  read?: boolean;
  groupId?: string;
  startTime?: number;
  endTime?: number;
}

export interface INotificationStats {
  total: number;
  unread: number;
  bySource: Record<NotificationSource, number>;
  byType: Record<NotificationType, number>;
}

/**
 * Notification event type for observable streaming.
 */
export type NotificationEventType = 'added' | 'updated' | 'removed' | 'cleared';

/**
 * Notification event emitted by NotificationService.
 */
export interface INotificationEvent {
  type: NotificationEventType;
  notification?: INotification;
  notificationId?: string;
}
