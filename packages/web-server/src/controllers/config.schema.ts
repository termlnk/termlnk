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

/**
 * Top-level config key for this plugin. Follows the "one key per plugin, use
 * subKey for persisted fields" rule. Phase 7.1a only carries runtime startup
 * params; Phase 7.1c will append persisted fields (SRP verifier, JWT secret
 * hash, ...) under subKeys on the same object.
 */
export const WEB_SERVER_PLUGIN_CONFIG_KEY = 'web-server.config';

/** Path prefix for tRPC HTTP endpoint. Coexists with SPA / auth endpoints. */
export const TRPC_HTTP_PATH_PREFIX = '/trpc';

/** Path for tRPC WebSocket subscriptions (mounted in P7.1b). */
export const TRPC_WS_PATH = '/trpc-ws';

/** Path prefix reserved for SRP6a + unlock-handshake endpoints (mounted in P7.1c). */
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
   * Plugin DI override — same mechanism as ElectronMainPlugin / SyncCorePlugin.
   * Tests can swap IWebServerService for an in-memory fake; deployments can
   * inject a custom IStaticFileService.
   */
  override?: DependencyOverride;
}

export const defaultPluginConfig: IWebServerConfig = {
  port: 3000,
  host: '127.0.0.1',
};
