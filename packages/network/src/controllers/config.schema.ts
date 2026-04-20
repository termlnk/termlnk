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

export const NETWORK_PLUGIN_CONFIG_KEY = 'network.config';

export const configSymbol = Symbol(NETWORK_PLUGIN_CONFIG_KEY);

export interface INetworkProxyConfig {
  enabled?: boolean;
  type?: 'socks5' | 'http';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
}

export interface INetworkConfig {
  /**
   * Use fetch instead of XMLHttpRequest.
   */
  useFetchImpl?: boolean;

  /**
   * Build in dependencies that can be overridden:
   *
   * - {@link HTTPService}
   * - {@link IHTTPImplementation}
   */
  override?: DependencyOverride;

  /**
   * Force to use a new instance of {@link HTTPService} and {@link IHTTPImplementation} even if
   * an ancestor injector already has them registered.
   */
  forceUseNewInstance?: boolean;

  proxy?: INetworkProxyConfig;
}

export const defaultPluginConfig: INetworkConfig = {};
