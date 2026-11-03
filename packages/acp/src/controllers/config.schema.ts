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
import type { IACPProviderCapabilities, IACPProviderDescriptor } from '../models/acp-provider';
import { DEFAULT_HANDSHAKE_TIMEOUT_MS, DEFAULT_PROBE_TIMEOUT_MS } from '../common/constants';

export const ACP_PLUGIN_CONFIG_KEY = 'acp.config';

export type ACPDefaultCwdStrategy = 'active-context' | 'home' | 'last-used';

export interface IACPPluginConfig {
  override?: DependencyOverride;
  /** User-defined providers (persisted). Catalog entries are never stored here. */
  userProviders?: IACPProviderDescriptor[];
  /** Provider ids the user switched off (persisted). */
  disabledProviders?: string[];
  /** Last capability probe per provider id (persisted). */
  providerCapabilities?: Record<string, IACPProviderCapabilities>;
  /** Model ids the user added by hand, per provider id (persisted). */
  customModels?: Record<string, string[]>;
  /** How to pick the default working directory when launching a session. */
  defaultCwdStrategy?: ACPDefaultCwdStrategy;
  /** When true, auto-select the first allow option on permission requests. */
  autoAcceptByDefault?: boolean;
  /** Binary version probe timeout (runtime). */
  probeTimeoutMs?: number;
  /** Deadline for the ACP `initialize` + session handshake (runtime). */
  handshakeTimeoutMs?: number;
}

export const defaultPluginConfig: IACPPluginConfig = {
  userProviders: [],
  disabledProviders: [],
  providerCapabilities: {},
  customModels: {},
  defaultCwdStrategy: 'active-context',
  autoAcceptByDefault: false,
  probeTimeoutMs: DEFAULT_PROBE_TIMEOUT_MS,
  handshakeTimeoutMs: DEFAULT_HANDSHAKE_TIMEOUT_MS,
};
