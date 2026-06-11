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

export { NON_SYNCABLE_CONFIG_KEYS, SYNC_MAX_BASE_VERSION_RETRIES, SYNC_PAYLOAD_PREFIX, SYNC_PAYLOAD_VERSION, SYNC_PUSH_BATCH_SIZE, SYNC_RESOURCES, SYNC_TRIGGER_INTERVALS } from './common/constants';
export type { SyncResourceId } from './common/constants';
export type { ISyncPluginConfig } from './controllers/config.schema';
export { SYNC_PLUGIN_CONFIG_KEY, SYNC_USER_ENABLED_FIELD } from './controllers/config.schema';
export type { ISyncCursor, ISyncFieldMeta, ISyncMutation, ISyncPatchItem } from './models/mutation';
export type { IResourceSyncStats, ISyncError, ISyncStats, SyncErrorCode } from './models/state';
export { SynchroniserStatus, SyncState } from './models/state';
export { SYNC_PLUGIN_NAME, SyncPlugin } from './plugin';
export { BACKUP_PAYLOAD_PREFIX, BACKUP_PAYLOAD_VERSION, IBackupClientService, IBackupService } from './services/backup.service';
export type { BackupImportMode, IBackupExportFileResult, IBackupExportSummary, IBackupImportFileResult, IBackupImportSummary } from './services/backup.service';
export { ISyncCryptoService } from './services/crypto.service';
export { ISyncOutboxService } from './services/outbox.service';
export type { IResourceSynchroniser, IResourceSynchroniserFactory } from './services/resource-synchroniser';
export {
  IBackupRepository,
  IHostSyncRepository,
  IIdentitySyncRepository,
  IMcpServerSyncRepository,
  IProviderSyncRepository,
  ISkillSyncRepository,
  ISshKeySyncRepository,
  ISyncConfigRepository,
  ISyncCursorRepository,
  ISyncFieldMetaRepository,
  ISyncOutboxRepository,
  ISyncRowMetaRepository,
  IKnownHostSyncRepository,
} from './services/repositories';
export type {
  IBackupSnapshot,
  IConfigChangeEvent,
  IConfigEntry,
  IProviderChangeEvent,
  ISyncCursorRow,
  ISyncEntityRow,
  ISyncHostChangeEvent,
  ISyncHostTreeNode,
  ISyncOutboxInsert,
  ISyncOutboxRow,
  ISyncRowChangeEvent,
  ISyncRowMeta,
  ISyncSkillRow,
  ISyncWritableRow,
} from './services/repositories';
export { ISyncService } from './services/sync.service';
export { ISyncTransportService } from './services/transport.service';
export type { IPokeMessage, IPullRequest, IPullResponse, IPushAcceptedDetail, IPushRequest, IPushResponse } from './services/transport.service';
