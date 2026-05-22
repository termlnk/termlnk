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

import type { ITokenManager } from '@termlnk/auth';
import type { IConfigService, ILogService, LogLevel } from '@termlnk/core';
import type { ICollabInviteServerView, ISharedTerminalPluginConfig } from '@termlnk/shared-terminal';
import { SHARED_TERMINAL_PLUGIN_CONFIG_KEY, SharedTerminalRole } from '@termlnk/shared-terminal';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpCollabInviteTransportService } from '../services/http-collab-invite-transport.service';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

class FixedTokenManager {
  constructor(private readonly _token: string | null) {}
  async getAccessToken(): Promise<string | null> {
    return this._token;
  }
}

// Service reads cloudBaseUrl from IConfigService now (fallback DEFAULT_CLOUD_BASE_URL if
// nothing configured). For testing we only need getConfig to return the test base url.
function fakeConfigService(cloudBaseUrl: string | undefined): IConfigService {
  return {
    getConfig<T>(key: string): T | undefined {
      if (key === SHARED_TERMINAL_PLUGIN_CONFIG_KEY) {
        return { cloudBaseUrl } as unknown as T;
      }
      return undefined;
    },
  } as unknown as IConfigService;
}

interface IRecordedCall {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

// Stubs globalThis.fetch and records every call. Lets each spec verify URL, method,
// headers and body without touching the real network.
function stubFetch(
  responses: Record<string, { ok: boolean; status: number; body: unknown }>
): IRecordedCall[] {
  const calls: IRecordedCall[] = [];
  const fetchStub = async (url: string, init: { method?: string; headers?: Record<string, string>; body?: string }) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body });
    const key = `${init.method ?? 'GET'} ${url}`;
    const resp = responses[key] ?? { ok: false, status: 404, body: { error: 'not registered' } };
    return {
      ok: resp.ok,
      status: resp.status,
      statusText: resp.ok ? 'OK' : 'Not Found',
      json: async () => resp.body,
      text: async () => JSON.stringify(resp.body),
    };
  };
  vi.stubGlobal('fetch', fetchStub);
  return calls;
}

function buildService(cloudBaseUrl: string | undefined, token: string | null): HttpCollabInviteTransportService {
  return new HttpCollabInviteTransportService(
    new FixedTokenManager(token) as unknown as ITokenManager,
    fakeConfigService(cloudBaseUrl),
    new NoopLogService()
  );
}

describe('HttpCollabInviteTransportService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pushCreate sends inviteId + capability + ephPub, with Bearer auth', async () => {
    const calls = stubFetch({
      'POST https://example.test/v1/collab/invite': { ok: true, status: 200, body: { invite: {} } },
    });
    const svc = buildService('https://example.test/v1/', 'my-jwt');
    await svc.pushCreate({
      inviteId: 'inv-1',
      sessionId: 'sess',
      role: SharedTerminalRole.Observer,
      capability: { v: 1, sid: 'sess', role: SharedTerminalRole.Observer, exp: 1, nonce: 'n' },
      capabilityHash: 'h',
      ephPubB64: 'pub',
      exp: 1,
      singleUse: true,
      note: 'demo',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.headers?.Authorization).toBe('Bearer my-jwt');
    const body = JSON.parse(calls[0]!.body!) as { inviteId: string; ephPubB64: string; ephPriv?: string };
    expect(body.inviteId).toBe('inv-1');
    expect(body.ephPubB64).toBe('pub');
    // Critical invariant: ephPriv never crosses the wire.
    expect(body.ephPriv).toBeUndefined();
  });

  it('pushRevoke encodes the inviteId in the path', async () => {
    const calls = stubFetch({
      'POST https://example.test/v1/collab/invite/inv%2F1/revoke': { ok: true, status: 204, body: {} },
    });
    const svc = buildService('https://example.test/v1', 'jwt');
    await svc.pushRevoke('inv/1');
    expect(calls[0]!.url).toBe('https://example.test/v1/collab/invite/inv%2F1/revoke');
  });

  it('list returns the parsed invites array', async () => {
    const fixture: ICollabInviteServerView[] = [{
      inviteId: 'a',
      sessionId: 's',
      role: SharedTerminalRole.CoPilot,
      capabilityHash: 'h',
      exp: 1,
      singleUse: true,
      status: 'active',
      createdAt: '2026-05-10T00:00:00.000Z',
    }];
    stubFetch({
      'GET https://example.test/v1/collab/invite': { ok: true, status: 200, body: { invites: fixture } },
    });
    const svc = buildService('https://example.test/v1', 'jwt');
    const got = await svc.list();
    expect(got).toEqual(fixture);
  });

  it('throws when no access token is available', async () => {
    stubFetch({});
    const svc = buildService('https://example.test/v1', null);
    await expect(svc.pushCreate({
      inviteId: 'inv',
      sessionId: 'sess',
      role: SharedTerminalRole.Observer,
      capability: { v: 1, sid: 'sess', role: SharedTerminalRole.Observer, exp: 1, nonce: 'n' },
      capabilityHash: 'h',
      ephPubB64: 'pub',
      exp: 1,
      singleUse: true,
    })).rejects.toThrow(/unauthenticated/);
  });

  it('surfaces non-2xx responses as errors', async () => {
    stubFetch({
      'POST https://example.test/v1/collab/invite': { ok: false, status: 409, body: { error: 'duplicate' } },
    });
    const svc = buildService('https://example.test/v1', 'jwt');
    await expect(svc.pushCreate({
      inviteId: 'inv',
      sessionId: 'sess',
      role: SharedTerminalRole.Observer,
      capability: { v: 1, sid: 'sess', role: SharedTerminalRole.Observer, exp: 1, nonce: 'n' },
      capabilityHash: 'h',
      ephPubB64: 'pub',
      exp: 1,
      singleUse: true,
    })).rejects.toThrow(/409/);
  });
});
