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

export default {
  'sync-ui': {
    status: {
      title: 'Cloud sync',
      'sync-now': 'Sync now',
      'force-resync': 'Resync from scratch',
      'force-resync-hint': 'Pulls every record again. Useful if you suspect local data is stale.',
      'never-synced': 'Never synced',
      'just-now': 'Synced just now',
      'minutes-ago': 'Synced {0} min ago',
      'hours-ago': 'Synced {0} h ago',
      'days-ago': 'Synced {0} d ago',
      pending: '{0} pending change(s)',
    },
    state: {
      idle: 'Up to date',
      syncing: 'Syncing',
      offline: 'Offline',
      error: 'Error',
      disabled: 'Disabled',
    },
    error: {
      unauthenticated: 'Sign in to sync',
      master_key_locked: 'Master key locked',
      network: 'Network error',
      rate_limited: 'Rate limited by server',
      protocol_mismatch: 'Client/server schema mismatch',
      cipher_mismatch: 'Decryption failed',
      server_error: 'Server error',
      unknown: 'Unknown error',
    },
  },
};
