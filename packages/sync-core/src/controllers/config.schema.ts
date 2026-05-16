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

import type { DependencyOverride } from '@termlnk/core';

export const SYNC_CORE_PLUGIN_CONFIG_KEY = 'sync-core.config';

export interface ISyncCorePluginConfig {
  override?: DependencyOverride;

  // Cloud root with version prefix (e.g. `https://cloud.termlnk.io/v1`). When set the
  // HTTP transport replaces the default Noop binding. With no URL, SyncService.enable()
  // immediately transitions to Offline; backup / import still work because they do not
  // depend on the network.
  cloudBaseUrl?: string;
}

export const defaultPluginConfig: ISyncCorePluginConfig = {};
