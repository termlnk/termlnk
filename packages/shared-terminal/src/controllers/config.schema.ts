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

export const SHARED_TERMINAL_PLUGIN_CONFIG_KEY = 'shared-terminal.config';

export interface ISharedTerminalPluginConfig {
  override?: DependencyOverride;

  /**
   * Relay base URL with protocol + version prefix
   * (e.g. `wss://relay.termlnk.cloud/v1`). When set, the daemon starts;
   * otherwise `ISharedTerminalService` stays inactive. Leave undefined to
   * disable shared-terminal entirely (mirrors the sync layer's
   * `cloudBaseUrl`).
   */
  relayBaseUrl?: string;

  /**
   * HTTPS root for owner-side collaboration management endpoints
   * (`/v1/collab/invite/{create,revoke,list}`). When configured PairingService
   * mirrors invite lifecycle to the server so distant devices (or the same
   * machine after re-install) can reconcile. Leave undefined to keep all
   * invite state local — relay still works because invites are signed offline.
   */
  cloudBaseUrl?: string;

  /**
   * Whether to start the daemon automatically after sign-in — architecture
   * §5.x "app startup → daemon ready". With `false`, the daemon starts only
   * when the user clicks "Add device" or "Start collaboration".
   */
  autoStartDaemon?: boolean;
}

export const defaultPluginConfig: ISharedTerminalPluginConfig = {
  autoStartDaemon: true,
};
