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
  'extension-ui': {
    menu: {
      extensions: 'Extensions',
    },
    action: {
      loadLocal: 'Load Local Extension',
      refresh: 'Refresh',
      enable: 'Enable',
      disable: 'Disable',
      uninstall: 'Uninstall',
      remove: 'Remove',
      reload: 'Reload',
      selectDirectory: 'Select Extension Directory',
      installFromNpm: 'Install from npm',
    },
    empty: 'No extensions installed',
    status: {
      activated: 'Active',
      disabled: 'Disabled',
      error: 'Error',
      installed: 'Installed',
    },
    tab: {
      installed: 'Installed',
      marketplace: 'Marketplace',
    },
    marketplace: {
      search: 'Search marketplace...',
      install: 'Install',
      installed: 'Installed',
      installing: 'Installing',
      loadFailed: 'Failed to load marketplace',
      empty: 'No extensions available',
      emptyHint: 'Use the download button in the header to install from npm directly.',
      installs: '{0} installs',
    },
    dialog: {
      installFromNpm: {
        title: 'Install Extension from npm',
        extensionId: 'Extension ID',
        packageName: 'NPM Package',
        version: 'Version',
        submit: 'Install',
        cancel: 'Cancel',
      },
    },
  },
};

export default locale;
