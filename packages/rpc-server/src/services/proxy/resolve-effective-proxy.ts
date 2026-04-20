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

import type { Nullable } from '@termlnk/core';
import type { ConfigRepository } from '@termlnk/database';
import type { IHost, IProxy } from '@termlnk/terminal';

export function resolveEffectiveProxy(hostProxy: Nullable<IProxy>, globalProxy: Nullable<IProxy>): IProxy | null {
  if (hostProxy?.enabled) {
    return hostProxy;
  }
  if (globalProxy?.enabled) {
    return { ...globalProxy };
  }
  return null;
}

export async function resolveHostWithProxy(host: IHost, configRepository: ConfigRepository): Promise<IHost> {
  const globalConfig = await configRepository.getField<IProxy>('network.config', 'proxy');
  const effectiveProxy = resolveEffectiveProxy(host.proxy, globalConfig);

  if (!effectiveProxy || effectiveProxy === host.proxy) {
    return host;
  }

  return { ...host, proxy: effectiveProxy };
}
