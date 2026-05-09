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

/**
 * termlnk-web server entrypoint (skeleton).
 *
 * Per docs/agent/cloud-sync-architecture.md §3.2 / §6.2 / §7.2 / §8.0 Phase 7,
 * this process will host:
 * - Hono + tRPC HTTP/WS adapter exposing @termlnk/rpc-server routers
 * - Static SPA hosting (apps/web/renderer dist)
 * - SRP6a master password unlock handshake
 * - Per-session in-memory master key with idle 30 min auto-clear
 * - SSH/SFTP/PTY/Agent/MCP execution (identical to apps/desktop/main, minus Electron)
 *
 * Implementation lands in P7.1 (`@termlnk/web-server` package) + P7.3 (this entrypoint).
 */

// eslint-disable-next-line no-console
console.log('termlnk-web server: not implemented yet (P7.1 + P7.3)');
process.exit(0);
