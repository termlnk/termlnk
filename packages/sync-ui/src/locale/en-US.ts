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
      'toggle-label': 'Sync',
      'sync-now': 'Sync now',
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
    backup: {
      title: 'Encrypted backup',
      description: 'Export and restore your hosts, configs, AI providers, MCP servers and skills as a single encrypted file. Master key required.',
      'locked-hint': 'Sign in first — encrypted backups need the master key derived from your password.',
      export: 'Export…',
      import: 'Restore…',
      exporting: 'Encrypting and writing backup…',
      importing: 'Reading and decrypting backup…',
      'export-success': 'Backup written successfully.',
      'import-success': 'Backup restored successfully.',
      'counts-summary': '{0} record(s) included',
      'import-confirm-title': 'Restore from encrypted backup?',
      'import-confirm-description': 'This will REPLACE all of your current hosts, configs, AI providers, MCP servers and skills with the contents of the backup file. This action cannot be undone.',
      'import-confirm-action': 'Replace and restore',
      cancel: 'Cancel',
    },
  },
};
