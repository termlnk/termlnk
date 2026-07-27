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

import type { ITokenManager, ITokenPair } from '@termlnk/auth';
import { HttpRequestError, ITokenRefresher, ITokenStorageService } from '@termlnk/auth';
import { Disposable, ILogService } from '@termlnk/core';

// Refresh proactively this many ms before the access token expires. Covers ~10 s clock
// drift plus typical RTT so concurrent callers do not race the deadline.
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 30_000;

// Backoff after a *retryable* refresh failure. Without it every caller that asks for a
// token re-fires the refresh immediately — and the sync transport's reconnect loop asks
// every 1-30 s, which would hammer a server that is merely restarting.
const REFRESH_RETRY_BACKOFF_INITIAL_MS = 5_000;
const REFRESH_RETRY_BACKOFF_MAX_MS = 5 * 60 * 1000;

// True when the server definitively rejected the refresh token itself, i.e. retrying can
// never succeed and the only way forward is a fresh sign-in.
//
// Everything else — offline, DNS failure, TLS error, 5xx, 429, malformed body — is
// transient. Clearing on those used to mean a laptop waking from sleep before Wi-Fi
// associated, or a server redeploy, permanently destroyed a 30-day session.
function isRefreshTokenRejected(err: unknown): boolean {
  if (!(err instanceof HttpRequestError)) {
    return false;
  }
  return err.status === 401 || err.status === 403;
}

// In-memory cache + proactive refresh + single-flight coalescing.
//
// Failure handling splits by cause: a rejected refresh token clears local state (the UI
// drives a re-login), while a transient failure keeps the tokens on disk and returns null
// so callers degrade to "offline" and the next attempt — after a backoff — can recover.
export class TokenManager extends Disposable implements ITokenManager {
  private _cache: ITokenPair | null = null;
  private _refreshPromise: Promise<ITokenPair> | null = null;

  // Epoch ms before which no refresh is attempted, and the backoff that produced it.
  private _refreshBlockedUntil = 0;
  private _refreshBackoffMs = REFRESH_RETRY_BACKOFF_INITIAL_MS;

  constructor(
    @ITokenStorageService private readonly _storage: ITokenStorageService,
    @ITokenRefresher private readonly _refresher: ITokenRefresher,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  override dispose(): void {
    super.dispose();
    this._cache = null;
    this._refreshPromise = null;
  }

  // Returns null when the user is logged out, the refresh chain has broken, or the token
  // is momentarily unrenewable (offline / server down). Callers cannot distinguish the
  // last case here by design — they should treat null as "no authorized call right now";
  // the session itself only ends when authState$ flips to Unauthenticated.
  //
  // An empty-string token is normalized to null: token values come verbatim from server
  // responses / storage, and an empty bearer is unusable — callers branching on `!token`
  // must never see a signed-in-but-empty state.
  async getAccessToken(): Promise<string | null> {
    const tokens = await this._loadTokens();
    if (!tokens) {
      return null;
    }

    const now = Date.now();
    if (tokens.accessTokenExpiresAt > now + ACCESS_TOKEN_REFRESH_MARGIN_MS) {
      return tokens.accessToken || null;
    }

    if (tokens.refreshTokenExpiresAt <= now) {
      this._logService.log('[TokenManager] refresh token expired; clearing local session');
      await this.clear();
      return null;
    }

    // Still inside a backoff window from an earlier transient failure. Returning the
    // (possibly just-expired) cached token would only produce a 401 downstream, so report
    // "no token" without spending a request.
    if (now < this._refreshBlockedUntil && this._refreshPromise === null) {
      return null;
    }

    try {
      const refreshed = await this._refreshOnce(tokens.refreshToken);
      return refreshed.accessToken || null;
    } catch (err) {
      if (isRefreshTokenRejected(err)) {
        this._logService.warn('[TokenManager] refresh token rejected by server; clearing local session:', err);
        await this.clear();
        return null;
      }
      // Transient: keep the tokens so a later attempt can recover the session.
      this._refreshBlockedUntil = Date.now() + this._refreshBackoffMs;
      this._logService.warn(
        `[TokenManager] token refresh failed (transient); keeping session, retrying in ${this._refreshBackoffMs}ms:`,
        err
      );
      this._refreshBackoffMs = Math.min(this._refreshBackoffMs * 2, REFRESH_RETRY_BACKOFF_MAX_MS);
      return null;
    }
  }

  async setTokens(tokens: ITokenPair): Promise<void> {
    this._cache = tokens;
    this._resetRefreshBackoff();
    await this._storage.save(tokens);
  }

  async clear(): Promise<void> {
    this._cache = null;
    this._refreshPromise = null;
    this._resetRefreshBackoff();
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

  private _resetRefreshBackoff(): void {
    this._refreshBlockedUntil = 0;
    this._refreshBackoffMs = REFRESH_RETRY_BACKOFF_INITIAL_MS;
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
