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

// Refresh proactively this many ms before the access token expires. Covers ~10 s clock
// drift plus typical RTT so concurrent callers do not race the deadline.
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 30_000;

// In-memory cache + proactive refresh + single-flight coalescing. Fail-soft on refresh
// failure: clears local state and returns null so the UI drives a re-login rather than
// having an RPC throw at the call site.
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

  // Returns null when the user is logged out or the refresh chain has broken.
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

  async setTokens(tokens: ITokenPair): Promise<void> {
    this._cache = tokens;
    await this._storage.save(tokens);
  }

  async clear(): Promise<void> {
    this._cache = null;
    this._refreshPromise = null;
    await this._storage.clear();
  }

  // Test/debug accessor: returns the currently cached pair without triggering a refresh.
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
