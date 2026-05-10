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
  'electron-renderer': {
    header: {
      'pin-enable': 'Pin window',
      'pin-disable': 'Unpin window',
    },
    'platform-tab': {
      label: 'Platform',
      description: 'Operating-system level integration: tray, auto-launch, and screen power management',
      'tray-enable': 'Enable System Tray',
      'tray-enable-description': 'Show an app icon in the system notification area with quick access menu',
      'close-to-tray': 'Minimize to Tray',
      'close-to-tray-description': 'Hide the window to system tray when closing instead of quitting the app',
      'startup-title': 'Startup',
      'auto-launch': 'Launch at Login',
      'auto-launch-description': 'Automatically start termlnk when you log into the system',
      'keep-awake-title': 'Keep Screen Awake',
      'keep-awake-description': 'Prevent the display from sleeping while an Agent session is running',
    },
  },
};

export default locale;
