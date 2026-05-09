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
import { enUS, jaJP, koKR, zhCN, zhTW } from './locales';
import { WebAuthCorePlugin } from './plugins/web-auth-core.plugin';

/** 当前协议版本——termlnk-server 把 `/v1/auth/*` 与 `/v1/sync/*` 挂在版本前缀下。 */
const API_VERSION_PREFIX = '/v1';

/**
 * 从 Vite env 读取云服务地址；未配置时 IAuthService 不绑定，AuthGate 渲染降级占位。
 *
 * 用户可填两种形态：
 * - 含版本前缀（如 `http://localhost:3001/v1`）—— 直接采用
 * - 不含前缀（如 `http://localhost:3001`）—— 由 normalizeBaseUrl 自动追加 `/v1`
 *
 * 这样用户配置时不需要记住 server 当前版本号；HttpAuthService / HttpSyncTransport
 * 在拼接 `${baseUrl}/auth/register` 时拿到的永远是带版本的合法路径。
 */
const CLOUD_BASE_URL: string | undefined = normalizeBaseUrl(
  import.meta.env.VITE_TERMLNK_CLOUD_URL
);

function normalizeBaseUrl(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return undefined;
  }
  // 已经手动带了 `/vX`（X 一位以上数字）就照原样保留——尊重用户显式选择的版本。
  if (/\/v\d+$/.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}${API_VERSION_PREFIX}`;
}

export function createWebCore(): Core {
  const core = new Core({
    theme: chadracula,
    logLevel: LogLevel.INFO,
    locale: LocaleType.EN_US,
    locales: { enUS, zhCN, zhTW, jaJP, koKR },
  });

  core.registerPlugin(AuthPlugin);
  core.registerPlugin(SyncPlugin);
  core.registerPlugin(WebAuthCorePlugin, { cloudBaseUrl: CLOUD_BASE_URL });
  core.registerPlugin(AuthUIPlugin);

  core.start();
  return core;
}
