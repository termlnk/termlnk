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

import type { ITokenPair, ITokenRefresher } from '@termlnk/auth';
import { Disposable, ILogService, Inject } from '@termlnk/core';

/**
 * 子集化的 fetch 函数签名——方便测试注入 fake；生产环境直接用 globalThis.fetch
 * （Node 22+ / 浏览器 / RN 原生提供）。
 */
export type HttpFetchFn = (url: string, init: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) => Promise<{ ok: boolean; status: number; statusText: string; json: () => Promise<unknown>; text: () => Promise<string> }>;

/**
 * HttpTokenRefresher 配置——构造时注入。
 */
export interface IHttpTokenRefresherConfig {
  /** 云服务根（如 `https://cloud.termlnk.io/v1`），与 sync transport 复用同一 baseUrl 即可。 */
  readonly baseUrl: string;
  /** fetch 实现注入点；默认 globalThis.fetch。 */
  readonly fetchFn?: HttpFetchFn;
}

const DEFAULT_FETCH_FN: HttpFetchFn = async (url, init) => {
  const resp = await globalThis.fetch(url, init as RequestInit);
  return {
    ok: resp.ok,
    status: resp.status,
    statusText: resp.statusText,
    json: () => resp.json(),
    text: () => resp.text(),
  };
};

/**
 * Wire format（与 cloud-sync-architecture.md §6.4 auth-service 一致）：
 *
 * ```
 * POST {baseUrl}/auth/refresh
 *   Body:     { refreshToken: string }
 *   Response: {
 *     accessToken: string,
 *     refreshToken: string,
 *     accessTokenExpiresAt: number,    // epoch ms
 *     refreshTokenExpiresAt: number,   // epoch ms
 *   }
 * ```
 *
 * 服务端**必须**在 refresh 时旋转 refreshToken（一次性），防止重放攻击。
 * 失败语义（HTTP status）：
 *   401 = refresh token 失效（撤销 / 过期）→ 抛错让 TokenManager 触发 clear
 *   429 = 限流 → 抛错；TokenManager 上层会 fail-soft 转发到 SyncErrorCode.rate_limited
 *   5xx = 服务端错误 → 抛错；TokenManager 上层会 fail-soft 转发到 server_error
 */
interface IRefreshRequestBody {
  refreshToken: string;
}

interface IRefreshResponseBody {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
}

/**
 * 调用云端 `/auth/refresh` 端点的 ITokenRefresher 实现。
 *
 * 与 SRP 登录路径的关系：
 * - 登录时（IAuthService.login）走 SRP6a 握手，最终签发 access+refresh token
 * - access 接近过期（30s margin）时 TokenManager 自动调本类 refresh
 * - refresh 失败 → TokenManager.clear → 用户须重新输入主密码登录（重走 SRP6a）
 *
 * 本类**不持有** master key 或 password。它的职责是单一的：拿 refreshToken 换新对。
 */
export class HttpTokenRefresher extends Disposable implements ITokenRefresher {
  private readonly _fetchFn: HttpFetchFn;

  constructor(
    private readonly _config: IHttpTokenRefresherConfig,
    @Inject(ILogService) private readonly _logService: ILogService
  ) {
    super();
    this._fetchFn = _config.fetchFn ?? DEFAULT_FETCH_FN;
  }

  async refresh(refreshToken: string): Promise<ITokenPair> {
    const url = `${this._config.baseUrl.replace(/\/+$/, '')}/auth/refresh`;
    const body: IRefreshRequestBody = { refreshToken };

    const resp = await this._fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      this._logService.warn(
        `[HttpTokenRefresher] refresh failed: ${resp.status} ${resp.statusText}${text ? ` — ${text.slice(0, 200)}` : ''}`
      );
      throw new Error(`token refresh failed: ${resp.status}`);
    }

    const json = await resp.json() as IRefreshResponseBody;

    // 防御：服务端协议错误的最小校验，防止 TokenManager 缓存非法值
    if (
      typeof json.accessToken !== 'string' || typeof json.refreshToken !== 'string'
      || typeof json.accessTokenExpiresAt !== 'number' || typeof json.refreshTokenExpiresAt !== 'number'
    ) {
      throw new TypeError('[HttpTokenRefresher] malformed refresh response');
    }

    return {
      accessToken: json.accessToken,
      refreshToken: json.refreshToken,
      accessTokenExpiresAt: json.accessTokenExpiresAt,
      refreshTokenExpiresAt: json.refreshTokenExpiresAt,
    };
  }
}
