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

import type { IIslandSettings, IIslandSoundConfig, IIslandSoundEventConfig } from '@termlnk/island';
import { isMacintosh } from '@termlnk/core';
import { normalizeIslandSoundConfig } from '@termlnk/island';

// Canonical definition in @termlnk/agent, re-exported from @termlnk/agent-core.
// Island settings are persisted under this key with subKey 'islandSettings'.
export { AGENT_CORE_PLUGIN_CONFIG_KEY } from '@termlnk/agent';
export type { IIslandSettings, IIslandSoundConfig, IIslandSoundEventConfig };

/** Outer-settings default: island is only enabled by default on macOS. */
const DEFAULT_ISLAND_ENABLED = isMacintosh;

export function normalizeIslandSettings(value: Partial<IIslandSettings> | null): IIslandSettings {
  return {
    enabled: typeof value?.enabled === 'boolean' ? value.enabled : DEFAULT_ISLAND_ENABLED,
    sound: normalizeIslandSoundConfig(value?.sound),
  };
}
