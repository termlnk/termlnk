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

// Top-level config key. Persisted fields live under subKeys on the same object.
export const WEB_SERVER_PLUGIN_CONFIG_KEY = 'web-server.config';

// Path prefix for tRPC HTTP endpoint.
export const TRPC_HTTP_PATH_PREFIX = '/trpc';

// Path for tRPC WebSocket subscriptions.
export const TRPC_WS_PATH = '/trpc-ws';

// Path prefix reserved for the browser auth handshake.
export const TERMLNK_WEB_AUTH_PATH_PREFIX = '/__termlnk-web';

export interface IWebServerConfig {
  /**
   * Listen port. Defaults to 3000.
   *
   * Recommended deployment: terminate TLS at nginx / caddy and reverse-proxy to
   * 127.0.0.1:3000; tlsCert / tlsKey can stay empty in that case.
   *
   * Direct deployment (home / single host): set both tlsCert and tlsKey to
   * make the process serve HTTPS itself.
   */
  port?: number;

  /**
   * Listen address. Defaults to `127.0.0.1` (loopback only) which is the safe
   * default behind a reverse proxy. Use `0.0.0.0` only for direct deployment.
   */
  host?: string;

  /**
   * Absolute path to the static SPA build output (must contain index.html).
   *
   * When unset the server only exposes tRPC + auth endpoints; everything else
   * gets a 404. Useful for API-only or test deployments.
   */
  staticRoot?: string;

  /**
   * Absolute path to the TLS certificate PEM file. Must be set together with
   * tlsKey or both must be omitted. When both are omitted the process serves
   * plain HTTP (intended for reverse-proxied deployments).
   */
  tlsCert?: string;

  /** Absolute path to the TLS private-key PEM file. Pairs with tlsCert. */
  tlsKey?: string;

  /**
   * Master password injection — required for the server to derive the master
   * key and the browser-login access verifier. Browser never sees the master
   * password through this knob: it lives in the deployer's environment, gets
   * read once at startup, and is wiped from memory after Argon2id runs.
   *
   * Resolution order on startup:
   *   1. `masterPassword` (literal — only for tests; never set in production).
   *   2. `<masterPasswordEnv>_FILE` file path (docker/k8s secrets; preferred in
   *      production so the secret never appears in the container environment).
   *   3. `masterPasswordEnv` env var (defaults to `TERMLNK_MASTER_PASSWORD`).
   *
   * Without any source available the server starts in `error` state with a
   * clear message; nothing else can come up because RPC procedures need the
   * master key to decrypt vault rows.
   */
  masterPassword?: string;
  masterPasswordEnv?: string;

  /**
   * Idle window before a browser session is auto-evicted from the in-memory
   * session map. Defaults to 30 minutes. The master key itself is not affected —
   * it lives with the process.
   */
  sessionIdleTimeoutMs?: number;

  /**
   * Plugin DI override — same mechanism as ElectronMainPlugin / SyncCorePlugin.
   * Tests can swap IWebServerService for an in-memory fake; deployments can
   * inject a custom IStaticFileService.
   */
  override?: DependencyOverride;
}

/** Default env var name to pull the master password from when `masterPassword` literal isn't set. */
export const DEFAULT_MASTER_PASSWORD_ENV = 'TERMLNK_MASTER_PASSWORD';

// Default browser-session idle timeout: 30 minutes.
export const DEFAULT_SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export const defaultPluginConfig: IWebServerConfig = {
  port: 3000,
  host: '127.0.0.1',
  masterPasswordEnv: DEFAULT_MASTER_PASSWORD_ENV,
  sessionIdleTimeoutMs: DEFAULT_SESSION_IDLE_TIMEOUT_MS,
};
