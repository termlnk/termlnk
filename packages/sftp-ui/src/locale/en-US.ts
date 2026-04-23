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
  'sftp-ui': {
    menu: {
      sftp: 'SFTP',
    },
    header: {
      'toggle-enter': 'Open SFTP browser',
      'toggle-exit': 'Close SFTP browser',
    },
    connection: {
      title: 'SFTP Connection',
      status: {
        connecting: 'Connecting...',
        authenticating: 'Authenticating...',
        opening: 'Opening SFTP...',
        ready: 'Connected',
        error: 'Connection failed',
      },
      action: {
        close: 'Close',
        retry: 'Retry',
        continue: 'Continue',
      },
      password: {
        title: 'Password Required',
        placeholder: 'Enter password',
      },
    },
    browser: {
      local: 'Local',
      remote: 'Remote',
      empty: 'Empty directory',
      loading: 'Loading...',
      items: '{count} items',
      selected: '{count} selected',
    },
    file: {
      name: 'Name',
      size: 'Size',
      modified: 'Modified',
      permissions: 'Permissions',
    },
    action: {
      download: 'Download',
      upload: 'Upload',
      rename: 'Rename',
      delete: 'Delete',
      newFolder: 'New Folder',
      permissions: 'Permissions',
      refresh: 'Refresh',
    },
    transfer: {
      title: 'Transfers',
      clearCompleted: 'Clear completed',
    },
    dialog: {
      rename: {
        title: 'Rename',
      },
      newFolder: {
        title: 'New Folder',
        placeholder: 'Folder name',
      },
      permissions: {
        title: 'Permissions',
        owner: 'Owner',
        group: 'Group',
        others: 'Others',
        read: 'Read',
        write: 'Write',
        execute: 'Execute',
        octal: 'Octal',
      },
    },
  },
};

export default locale;
