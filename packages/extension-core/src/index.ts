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

export { EXTENSION_CORE_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
export type { IExtensionCorePluginConfig } from './controllers/config.schema';
export { EXTENSION_CORE_PLUGIN_NAME, ExtensionCorePlugin } from './plugin';
export { ExtensionInstallService, IExtensionInstallService } from './services/extension-install.service';
export { ExtensionRegistryService } from './services/extension-registry.service';
export { ExtensionStateService } from './services/extension-state.service';
export { ExtensionStorageService } from './services/extension-storage.service';
