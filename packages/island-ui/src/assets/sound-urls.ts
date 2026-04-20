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

import { CespEventCategory } from '@termlnk/island';

/**
 * Resolved URLs for built-in CESP sound assets.
 * Uses Vite's `new URL()` pattern — URLs are resolved at build time.
 *
 * Shared between IslandSoundService (island renderer) and
 * settings-ui preview playback (main renderer).
 */
export const CESP_SOUND_ASSET_URLS: ReadonlyMap<CespEventCategory, string> = new Map([
  [CespEventCategory.SessionStart, new URL('./sounds/session-start.wav', import.meta.url).href],
  [CespEventCategory.TaskAcknowledge, new URL('./sounds/task-acknowledge.wav', import.meta.url).href],
  [CespEventCategory.TaskComplete, new URL('./sounds/task-complete.wav', import.meta.url).href],
  [CespEventCategory.TaskError, new URL('./sounds/task-error.wav', import.meta.url).href],
  [CespEventCategory.InputRequired, new URL('./sounds/input-required.wav', import.meta.url).href],
  [CespEventCategory.ResourceLimit, new URL('./sounds/resource-limit.wav', import.meta.url).href],
  [CespEventCategory.UserSpam, new URL('./sounds/user-spam.wav', import.meta.url).href],
]);

/**
 * Maps settings-ui config keys to their CESP sound asset URL.
 * Used by the settings preview button to play the correct sound.
 */
export const SOUND_CONFIG_KEY_TO_URL: Readonly<Record<string, string>> = {
  sessionStart: CESP_SOUND_ASSET_URLS.get(CespEventCategory.SessionStart)!,
  taskConfirmed: CESP_SOUND_ASSET_URLS.get(CespEventCategory.TaskAcknowledge)!,
  taskComplete: CESP_SOUND_ASSET_URLS.get(CespEventCategory.TaskComplete)!,
  taskError: CESP_SOUND_ASSET_URLS.get(CespEventCategory.TaskError)!,
  needsApproval: CESP_SOUND_ASSET_URLS.get(CespEventCategory.InputRequired)!,
  contextLimit: CESP_SOUND_ASSET_URLS.get(CespEventCategory.ResourceLimit)!,
  rapidSubmitDetection: CESP_SOUND_ASSET_URLS.get(CespEventCategory.UserSpam)!,
};
