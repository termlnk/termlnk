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

// Platform-agnostic sync engine — implementations of the @termlnk/sync contracts that
// depend only on injectable repository interfaces, never on a concrete persistence layer.
// The desktop binds these against Drizzle (@termlnk/database); mobile binds them against
// expo-sqlite repositories.
export { BackupService } from './services/backup.service';
export { SyncCryptoService } from './services/crypto.service';
export { HttpSyncTransportService } from './services/http-transport.service';
export type { HttpFetchFn, HttpWebSocketCtor, IHttpSyncTransportConfig, IHttpWebSocket } from './services/http-transport.service';
export { NoopSyncTransportService } from './services/noop-transport.service';
export { SyncOutboxService } from './services/outbox.service';
export { SyncService } from './services/sync.service';
export { ConfigSynchroniser } from './synchronisers/config-synchroniser';
export { HostSynchroniser } from './synchronisers/host-synchroniser';
export { IdentitySynchroniser } from './synchronisers/identity-synchroniser';
export { KnownHostSynchroniser } from './synchronisers/known-host-synchroniser';
export { McpSynchroniser } from './synchronisers/mcp-synchroniser';
export { PortForwardingRuleSynchroniser } from './synchronisers/port-forwarding-rule-synchroniser';
export { ProviderSynchroniser } from './synchronisers/provider-synchroniser';
export { SkillSynchroniser } from './synchronisers/skill-synchroniser';
export { SnippetSynchroniser } from './synchronisers/snippet-synchroniser';
export { SshKeySynchroniser } from './synchronisers/ssh-key-synchroniser';
