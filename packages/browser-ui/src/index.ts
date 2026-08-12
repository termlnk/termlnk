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

export { ToggleBrowserPanelCommand } from './commands/toggle-browser-panel.command';
export {
  BROWSER_FOCUSED_CONTEXT,
  BROWSER_PANEL_ID,
  BROWSER_UI_PLUGIN_NAME,
} from './common/constants';
export { BROWSER_UI_PLUGIN_CONFIG_KEY, defaultPluginConfig } from './controllers/config.schema';
export type { IBrowserUIPluginConfig } from './controllers/config.schema';
export { BrowserUIPlugin } from './plugin';
export { BrowserService, IBrowserService } from './services/browser.service';
export type { IBrowserTab } from './services/browser.service';
