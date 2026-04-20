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

/**
 * Extension path constants.
 *
 * NOTE: These are path segment constants only. Actual path resolution
 * (using configPath from IRPCConfig, path.join, etc.) is done in the
 * main process via the extensionRouter tRPC routes.
 */

/** Directory name for installed extensions. */
export const EXTENSIONS_DIR_NAME = 'extensions';

/** Directory name for extension data storage. */
export const EXTENSION_DATA_DIR_NAME = 'extension-data';

/** Filename for the extension state file. */
export const EXTENSION_STATE_FILENAME = 'extension-state.json';

/** LocalStorage key prefix for extension state. */
export const EXTENSION_STATE_STORAGE_KEY = 'termlnk.extension-state';
