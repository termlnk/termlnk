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

  // Whether sync auto-enables right after login. Defaults to true; consumed by
  // AuthSyncBridgeController only at the login moment, so subsequent manual toggles
  // via SyncStatusPanel are not overwritten.
  autoEnableOnLogin?: boolean;

  // User-controlled exclusions. Note that chat-family resources are never synced
  // regardless of this list; this field only affects the optional resources.
  excludedResources?: SyncResourceId[];

  // Per-device client ID for server-side mutation deduplication. Generated and persisted
  // on first launch via ConfigRepository.setField.
  clientId?: string;

  // Internal: highest client_mut_id ever emitted on this device. Persisted by
  // SyncOutboxService and read back at startup so an emptied outbox does not restart
  // numbering from 0 (which would let the server re-deduplicate stale mutations).
  // Not user-editable.
  lastClientMutId?: number;
}

export const defaultPluginConfig: ISyncPluginConfig = {
  autoEnableOnLogin: true,
  excludedResources: [],
};
