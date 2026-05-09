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

export const SYNC_PLUGIN_NAME = 'SYNC_PLUGIN';
export const SYNC_PLUGIN_CONFIG_KEY = 'sync.config';

// Resource IDs that map to SQLite tables. All except `config` use row-level LWW; `config`
// is field-level LWW because its value is a nested JSON blob. Chat-family rows, terminal
// session backups and MCP OAuth tokens are intentionally never synced.
export const SYNC_RESOURCES = ['host', 'config', 'ai_provider', 'mcp_server', 'skill'] as const;
export type SyncResourceId = (typeof SYNC_RESOURCES)[number];

// Trigger cadences in milliseconds.
export const SYNC_TRIGGER_INTERVALS = {
  // Local change -> outbox flush.
  pushDebounceMs: 500,
  // Server poke -> pull.
  pullDebounceMs: 200,
  // Background poll backstop; the primary path is poke-driven.
  pollIntervalMs: 5 * 60 * 1000,
  // WebSocket heartbeat.
  heartbeatMs: 30 * 1000,
} as const;

// Bump on algorithm change so the decrypt path can dispatch by version.
export const SYNC_PAYLOAD_VERSION = 1;

// Payload magic; distinct from the local SafeStorage prefix `tmenc1:`.
export const SYNC_PAYLOAD_PREFIX = 'tmsync1:';
