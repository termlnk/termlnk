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

const locale = {
  ui: {
    'icon-picker': {
      'search-placeholder': 'Search emojis...',
      style: 'Background',
      'reset-default': 'Reset to default',
      'no-results': 'No emojis found',
    },
    'notification-panel': {
      title: 'Notifications',
      filter: {
        all: 'All',
        unread: 'Unread',
      },
      actions: {
        'mark-all-read': 'Mark all read',
        'mark-all-read-title': 'Mark all as read',
        'clear-all-title': 'Clear all',
        'mark-read-title': 'Mark as read',
        'remove-title': 'Delete',
      },
      empty: 'No notifications',
      source: {
        prefix: 'From: {0}',
        terminal: 'Terminal',
        system: 'System',
        extension: 'Extension',
        application: 'Application',
        agent: 'Agent',
      },
      time: {
        'just-now': 'Just now',
        'minutes-ago': '{0} minutes ago',
        'hours-ago': '{0} hours ago',
        'days-ago': '{0} days ago',
      },
      footer: {
        total: '{0} notifications',
        unread: '{0} unread',
        'total-with-unread': '{0} notifications, {1} unread',
      },
    },
    'notification-icon': {
      title: 'Notifications',
      'unread-title': '{0} unread notifications',
    },
    'right-sidebar-toggle': {
      'open-title': 'Open right sidebar',
      'close-title': 'Close right sidebar',
    },
    'left-sidebar-toggle': {
      'open-title': 'Show left sidebar',
      'close-title': 'Hide left sidebar',
    },
    updater: {
      'dialog-title': 'New Version Available',
      'new-version-available': 'New version available',
      'update-ready': 'Update ready',
      'release-notes': 'Release Notes',
      'download-update': 'Download Update',
      downloading: 'Downloading...',
      'install-now': 'Install Now',
      retry: 'Retry',
      'manual-update-hint': 'A new version is available. Pull the latest docker image or run git pull to update — in-app installation is not supported in browser deployments.',
    },
  },
};

export default locale;
