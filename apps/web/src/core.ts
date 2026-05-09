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

import { AuthPlugin } from '@termlnk/auth';
import { AuthUIPlugin } from '@termlnk/auth-ui';
import { Core, LocaleType, LogLevel } from '@termlnk/core';
import { SyncPlugin } from '@termlnk/sync';
import { chadracula } from '@termlnk/themes';
import { WebAuthCorePlugin } from './plugins/web-auth-core.plugin';

/** 从 Vite env 读取云服务地址；未配置时 IAuthService 不绑定，AuthGate 渲染降级占位。 */
const CLOUD_BASE_URL: string | undefined = import.meta.env.VITE_TERMLNK_CLOUD_URL;

export function createWebCore(): Core {
  const core = new Core({
    theme: chadracula,
    logLevel: LogLevel.INFO,
    locale: LocaleType.EN_US,
  });

  core.registerPlugin(AuthPlugin);
  core.registerPlugin(SyncPlugin);
  core.registerPlugin(WebAuthCorePlugin, { cloudBaseUrl: CLOUD_BASE_URL });
  core.registerPlugin(AuthUIPlugin);

  core.start();
  return core;
}
