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

import './global.css';

export { ToggleSettingsCommand } from './commands/toggle-settings.command';
export { SETTINGS_UI_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
export type { ISettingsUIConfig } from './controllers/config.schema';
export { SettingsController } from './controllers/settings/settings.controller';
export { SettingsTab } from './models/settings.state';
export { SETTINGS_UI_PLUGIN_NAME, SettingsUIPlugin } from './plugin';
export type { ISettingsTabDescriptor } from './services/settings-tab-registry/settings-tab-registry.service';
export { ISettingsTabRegistryService, SettingsTabRegistryService } from './services/settings-tab-registry/settings-tab-registry.service';
export { SettingsService } from './services/settings/settings.service';
