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

import type { ILogService, LogLevel } from '@termlnk/core';
import type { HttpFetchFn } from '../services/http-token-refresher.service';
import { describe, expect, it } from 'vitest';
import { HttpTokenRefresher } from '../services/http-token-refresher.service';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

interface IFetchCall {
  url: string;
  init: { method?: string; headers?: Record<string, string>; body?: string };
}

function makeFakeFetch(response: { status: number; json?: unknown; text?: string }): {
  fetch: HttpFetchFn;
  calls: IFetchCall[];
} {
  const calls: IFetchCall[] = [];
  const fetch: HttpFetchFn = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.status === 200 ? 'OK' : 'Error',
      json: async () => response.json,
      text: async () => response.text ?? '',
    };
  };
  return { fetch, calls };
}

describe('HttpTokenRefresher', () => {
  it('POSTs the refreshToken in JSON body and returns the new pair', async () => {
    const next = {
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      accessTokenExpiresAt: 1_700_001_000_000,
      refreshTokenExpiresAt: 1_702_000_000_000,
    };
    const { fetch, calls } = makeFakeFetch({ status: 200, json: next });
    const refresher = new HttpTokenRefresher(
      { baseUrl: 'https://cloud.example/v1', fetchFn: fetch },
      new NoopLogService()
    );

    const result = await refresher.refresh('old-refresh-token');
    expect(result).toEqual(next);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://cloud.example/v1/auth/refresh');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers?.['Content-Type']).toBe('application/json');
    expect(JSON.parse(calls[0].init.body!)).toEqual({ refreshToken: 'old-refresh-token' });
    refresher.dispose();
  });

  it('throws on 401 (refresh token revoked / expired)', async () => {
    const { fetch } = makeFakeFetch({ status: 401, text: 'invalid token' });
    const refresher = new HttpTokenRefresher(
      { baseUrl: 'https://cloud.example/v1', fetchFn: fetch },
      new NoopLogService()
    );

    await expect(refresher.refresh('stale')).rejects.toThrow(/401/);
    refresher.dispose();
  });

  it('throws on 5xx (server error) and on 429 (rate limit)', async () => {
    for (const status of [500, 503, 429]) {
      const { fetch } = makeFakeFetch({ status, text: 'oops' });
      const refresher = new HttpTokenRefresher(
        { baseUrl: 'https://cloud.example/v1', fetchFn: fetch },
        new NoopLogService()
      );
      await expect(refresher.refresh('x')).rejects.toThrow(new RegExp(String(status)));
      refresher.dispose();
    }
  });

  it('throws on malformed response (missing field)', async () => {
    const { fetch } = makeFakeFetch({
      status: 200,
      json: { accessToken: 'a', refreshToken: 'r' /* missing expiresAt fields */ },
    });
    const refresher = new HttpTokenRefresher(
      { baseUrl: 'https://cloud.example/v1', fetchFn: fetch },
      new NoopLogService()
    );

    await expect(refresher.refresh('x')).rejects.toThrow(/malformed/i);
    refresher.dispose();
  });

  it('strips trailing slash from baseUrl', async () => {
    const { fetch, calls } = makeFakeFetch({
      status: 200,
      json: {
        accessToken: 'a',
        refreshToken: 'r',
        accessTokenExpiresAt: 1,
        refreshTokenExpiresAt: 2,
      },
    });
    const refresher = new HttpTokenRefresher(
      { baseUrl: 'https://cloud.example/v1/', fetchFn: fetch },
      new NoopLogService()
    );

    await refresher.refresh('x');
    expect(calls[0].url).toBe('https://cloud.example/v1/auth/refresh');
    refresher.dispose();
  });
});
