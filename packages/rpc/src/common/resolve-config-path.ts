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

import type { IConfigService } from '@termlnk/core';
import type { IRPCConfig } from '../controllers/config.schema';
import { RPC_PLUGIN_CONFIG_KEY } from '../controllers/config.schema';

export function resolveConfigPath(configService: IConfigService): string {
  const config = configService.getConfig<IRPCConfig>(RPC_PLUGIN_CONFIG_KEY);
  if (!config?.configPath) {
    throw new Error('[RPC] configPath is not configured. Ensure RPCPlugin is registered with a configPath.');
  }
  return config.configPath;
}
