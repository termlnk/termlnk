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

import type { BrowserWindowConstructorOptions } from 'electron';

export const DEFAULT_WINDOW_OPTIONS: BrowserWindowConstructorOptions = {
  width: 800,
  height: 500,
  minWidth: 800,
  minHeight: 500,
  show: false,
  autoHideMenuBar: true,
  alwaysOnTop: false,
  webPreferences: {
    sandbox: false,
    nodeIntegration: true,
    // contextIsolation: true,
    // Chrome inputs (host name, port, search) are not prose — red spellcheck
    // squiggles read as a web page, not a native app. Content fields opt in
    // per-element via the `spellcheck` attribute instead.
    spellcheck: false,
  },
};
