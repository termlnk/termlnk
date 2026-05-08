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

export {
  SYNC_PAYLOAD_PREFIX,
  SYNC_PAYLOAD_VERSION,
  SYNC_PLUGIN_CONFIG_KEY,
  SYNC_PLUGIN_NAME,
  SYNC_RESOURCES,
  SYNC_TRIGGER_INTERVALS,
} from './common/constants';
export type { SyncResourceId } from './common/constants';
export type { ISyncPluginConfig } from './controllers/config.schema';
export type { ISyncCursor, ISyncFieldMeta, ISyncMutation, ISyncPatchItem } from './models/mutation';
export type { IResourceSyncStats, ISyncError, ISyncStats, SyncErrorCode } from './models/state';
export { SynchroniserStatus, SyncState } from './models/state';
export { SyncPlugin } from './plugin';
export { ISyncCryptoService } from './services/crypto.service';
export { ISyncOutboxService } from './services/outbox.service';
export type { IResourceSynchroniser, IResourceSynchroniserFactory } from './services/resource-synchroniser';
export { ISyncService } from './services/sync.service';
export { ISyncTransportService } from './services/transport.service';
export type { IPokeMessage, IPullRequest, IPullResponse, IPushRequest, IPushResponse } from './services/transport.service';
