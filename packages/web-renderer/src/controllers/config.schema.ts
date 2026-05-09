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

export const WEB_RENDERER_PLUGIN_CONFIG_KEY = 'web-renderer.config';

/** Mirrors @termlnk/web-server's TRPC_HTTP_PATH_PREFIX. */
export const TRPC_HTTP_PATH = '/trpc';

/** Mirrors @termlnk/web-server's TRPC_WS_PATH. */
export const TRPC_WS_PATH = '/trpc-ws';

export interface IWebRendererConfig {
  /**
   * Origin override for the tRPC HTTP / WS endpoints. Defaults to "" (relative
   * URLs against `window.location`), which is the recommended same-origin
   * deployment. Set this only when the SPA is served from a different origin
   * than the API (rare; CORS becomes the deployer's problem).
   */
  origin?: string;

  override?: DependencyOverride;
}

export const defaultPluginConfig: IWebRendererConfig = {
  origin: '',
};
