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

// Minimal subset of fetch we depend on — easier to fake in tests; production uses
// globalThis.fetch (native on Node 22+, browsers, RN).
export type HttpFetchFn = (url: string, init: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) => Promise<{ ok: boolean; status: number; statusText: string; json: () => Promise<unknown>; text: () => Promise<string> }>;

export interface IHttpTokenRefresherConfig {
  // Cloud root, e.g. `https://cloud.termlnk.io/v1`. The sync transport reuses the same baseUrl.
  readonly baseUrl: string;
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

// Wire format:
//   POST {baseUrl}/auth/refresh
//     Body:     { refreshToken: string }
//     Response: { accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt }
//
// The server MUST rotate refreshToken on every refresh (single-use) to defeat replay.
// Status semantics:
//   401 — refresh token invalid or expired (TokenManager will clear).
//   429 — rate limited.
//   5xx — server error.
interface IRefreshRequestBody {
  refreshToken: string;
}

interface IRefreshResponseBody {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
}

// Calls /auth/refresh. This class never holds the master key or the password — its sole
// job is exchanging a refreshToken for a new pair. A failed refresh propagates upward so
// TokenManager can fail-soft into "logged out".
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

    // Minimal shape check so we never cache a malformed pair.
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
