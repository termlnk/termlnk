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
import type { SyncResourceId } from '../common/constants';

export const SYNC_PLUGIN_CONFIG_KEY = 'sync.config';

export interface ISyncPluginConfig {
  override?: DependencyOverride;

  // First-login fallback only. Once userEnabled is written this hint is ignored.
  autoEnableOnLogin?: boolean;

  // Persisted toggle position. Survives app restart so AuthSyncBridgeController can
  // restore the in-memory _enabled$ on the next Authenticated tick.
  userEnabled?: boolean;

  // chat-family resources are never synced regardless of this list.
  excludedResources?: SyncResourceId[];

  // Per-device client ID for server-side mutation deduplication.
  clientId?: string;

  // Highest client_mut_id ever emitted; persisted so an emptied outbox does not
  // restart from 0 (the server would re-dedupe stale mutations).
  lastClientMutId?: number;
}

// Shared subKey for ConfigRepository.getField / setField. Single source for
// SyncService (writer) and AuthSyncBridgeController (reader).
export const SYNC_USER_ENABLED_FIELD: keyof ISyncPluginConfig = 'userEnabled';

export const defaultPluginConfig: ISyncPluginConfig = {
  autoEnableOnLogin: true,
  excludedResources: [],
};
