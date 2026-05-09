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

export { AUTH_PLUGIN_CONFIG_KEY } from '../common/constants';

export interface IAuthPluginConfig {
  override?: DependencyOverride;

  // Idle minutes before auto-lock; 0 disables. Manual logout always locks.
  // IdleLockController in @termlnk/auth-core polls this and calls IMasterKeyService.lock().
  autoLockIdleMinutes?: number;
}

// The cloud base URL is intentionally not declared here. It is a startup parameter consumed
// by AuthCorePlugin (IAuthCorePluginConfig.cloudBaseUrl); duplicating it would create a
// confusing contract-vs-impl split where only the impl side actually wins.

export const defaultPluginConfig: IAuthPluginConfig = {
  autoLockIdleMinutes: 0,
};
