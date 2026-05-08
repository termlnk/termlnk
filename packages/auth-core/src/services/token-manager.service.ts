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

import type { ITokenPair, ITokenRefresher, ITokenStorageService } from '@termlnk/auth';
import { ITokenRefresher as ITokenRefresherId, ITokenStorageService as ITokenStorageServiceId } from '@termlnk/auth';
import { Disposable, ILogService, Inject } from '@termlnk/core';

/**
 * accessToken 提前续期的余量——还剩少于此时间就触发刷新，避免高并发下打到边界。
 * 30 秒覆盖典型云服务的 ~10 秒时钟漂移 + 网络往返预留。
 */
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 30_000;

/**
 * 主进程 access/refresh token 缓存与自动续期协调器。
 *
 * 不实现 IAuthService（那是 P1.6）；仅提供"获取一个仍然有效的 accessToken"这个
 * 单一职责，让 IAuthService 能直接复用，也让 RPC 拦截器在 P3 实现时有干净边界。
 *
 * 设计要点：
 * - **首次 load 时缓存**：避免每次 getAccessToken 都跑一次 cipher.decrypt（贵）
 * - **Promise 合并**：多个 caller 在 token 即将过期时同时调用 → 只发一次 refresh
 * - **fail-soft**：refresh 失败（网络/refresh 过期）→ 清空 cache + storage，返回 null 让上层触发重新登录
 *
 * 不持久化 in-memory cache：dispose 时清空，避免 GC 不及时残留 token 引用。
 */
export class TokenManager extends Disposable {
  private _cache: ITokenPair | null = null;
  private _refreshPromise: Promise<ITokenPair> | null = null;

  constructor(
    @Inject(ITokenStorageServiceId) private readonly _storage: ITokenStorageService,
    @Inject(ITokenRefresherId) private readonly _refresher: ITokenRefresher,
    @Inject(ILogService) private readonly _logService: ILogService
  ) {
    super();
  }

  override dispose(): void {
    this._cache = null;
    this._refreshPromise = null;
    super.dispose();
  }

  /**
   * 取出当前可用的 accessToken；若临近过期会先静默 refresh。
   * 未登录或 refresh 链断（refresh token 过期 / refresh 失败）→ 返回 null。
   */
  async getAccessToken(): Promise<string | null> {
    const tokens = await this._loadTokens();
    if (!tokens) {
      return null;
    }

    const now = Date.now();
    if (tokens.accessTokenExpiresAt > now + ACCESS_TOKEN_REFRESH_MARGIN_MS) {
      return tokens.accessToken;
    }

    if (tokens.refreshTokenExpiresAt <= now) {
      this._logService.log('[TokenManager] refresh token expired; clearing local session');
      await this.clear();
      return null;
    }

    try {
      const refreshed = await this._refreshOnce(tokens.refreshToken);
      return refreshed.accessToken;
    } catch (err) {
      this._logService.warn('[TokenManager] token refresh failed; clearing local session:', err);
      await this.clear();
      return null;
    }
  }

  /** 注册/登录成功后写入；同步更新 cache 和 storage。 */
  async setTokens(tokens: ITokenPair): Promise<void> {
    this._cache = tokens;
    await this._storage.save(tokens);
  }

  /** 登出 / refresh 失败 / 用户主动撤销时调用。 */
  async clear(): Promise<void> {
    this._cache = null;
    this._refreshPromise = null;
    await this._storage.clear();
  }

  /** 测试 / 调试访问点：当前缓存的 token 对（不触发 refresh）。 */
  peekCached(): ITokenPair | null {
    return this._cache;
  }

  private async _loadTokens(): Promise<ITokenPair | null> {
    if (this._cache) {
      return this._cache;
    }
    const loaded = await this._storage.load();
    this._cache = loaded;
    return loaded;
  }

  private async _refreshOnce(refreshToken: string): Promise<ITokenPair> {
    if (this._refreshPromise) {
      return this._refreshPromise;
    }

    this._refreshPromise = (async () => {
      try {
        const next = await this._refresher.refresh(refreshToken);
        await this.setTokens(next);
        return next;
      } finally {
        this._refreshPromise = null;
      }
    })();

    return this._refreshPromise;
  }
}
