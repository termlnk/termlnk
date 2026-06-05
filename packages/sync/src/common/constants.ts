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

// Resource IDs that map to SQLite tables. All except `config` use row-level LWW; `config`
// is field-level LWW because its value is a nested JSON blob. Chat-family rows, terminal
// session backups and MCP OAuth tokens are intentionally never synced.
export const SYNC_RESOURCES = [
  'host',
  'config',
  'ai_provider',
  'mcp_server',
  'skill',
  'ssh_key',
  'identity',
  'known_host',
] as const;
export type SyncResourceId = (typeof SYNC_RESOURCES)[number];

// Trigger cadences in milliseconds.
export const SYNC_TRIGGER_INTERVALS = {
  // Local change -> outbox flush.
  pushDebounceMs: 500,
  // Server poke -> pull.
  pullDebounceMs: 200,
  // Background poll backstop; the primary path is poke-driven.
  pollIntervalMs: 5 * 60 * 1000,
  // WebSocket keepalive cadence. Kept well below the 60s idle timeout common to Nginx /
  // ALB / Cloudflare so three heartbeats fit inside any proxy window.
  heartbeatMs: 15 * 1000,
  // No inbound frame for this long => connection is dead even if the socket still looks
  // open; the transport force-closes and lets the reconnect backoff take over. ~3x
  // heartbeatMs so a single dropped pong does not cause spurious reconnects.
  idleTimeoutMs: 45 * 1000,
} as const;

// Max mutations the SyncService sends in a single push request. The transport peels off
// mutations in FIFO order; the loop keeps pumping until the outbox drains or push errors.
// Bound chosen to keep the HTTP body well under any reasonable server limit even with
// 32 KiB encrypted payloads (200 * 32 KiB ~= 6.4 MiB).
export const SYNC_PUSH_BATCH_SIZE = 200;

// Max times a row-level mutation may be re-pushed after a baseVersion conflict before the
// outbox drops it. Local-first conflict resolution rebases the mutation onto the latest
// server version and retries; this cap stops two devices editing the same row from
// ping-ponging forever — past the cap the local change yields to the remote value.
export const SYNC_MAX_BASE_VERSION_RETRIES = 5;

// Plugin config keys whose contents are device-specific runtime state — never sync across
// devices. Used by the `config` resource synchroniser to drop both inbound patches and
// outbound mutations for these keys, and to purge any residual outbox rows on startup.
//
// Rule of thumb: anything written by the engine itself (sync.config.clientId,
// sync.config.lastClientMutId), the auth stack (tokens, deviceId), or per-device
// platform integration state (window position, OS keystore handles) lives here.
export const NON_SYNCABLE_CONFIG_KEYS: ReadonlySet<string> = new Set([
  // sync engine internals (clientId, lastClientMutId, autoEnableOnLogin, excludedResources)
  'sync.config',
  // auth tokens + deviceId + idle-lock config
  'auth.config',
  // desktop runtime (appSettings, override) + main-process window state
  'electron.config',
  'electron-main.config',
]);

// Bump on algorithm change so the decrypt path can dispatch by version.
export const SYNC_PAYLOAD_VERSION = 1;

// Payload magic; distinct from the local SafeStorage prefix `tmenc1:`.
export const SYNC_PAYLOAD_PREFIX = 'tmsync1:';
