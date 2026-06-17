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

export { SOUND_CONFIG_KEY_TO_URL } from './assets/sound-urls';
export { ISLAND_UI_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
export type { IIslandUIPluginConfig } from './controllers/config.schema';
export { IslandUIController } from './controllers/island-ui.controller';
export { ISLAND_UI_PLUGIN_NAME, IslandUIPlugin } from './plugin';
export { IIslandSoundService } from './services/island-sound.service';
export { IIslandUIStateService } from './services/island-state.service';
export { ISLAND_SETTINGS_PLUGIN_NAME, IslandSettingsPlugin } from './settings-plugin';
export { DynamicIsland } from './views/island/DynamicIsland';
export { NotchLayer } from './views/island/NotchLayer';
