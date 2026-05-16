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

// Deep import: must match the resolution path used by http-transport.service.ts so the
// TypeScript nominal identity of TokenManager stays single — going through the package
// barrel would resolve to lib/types and create a second incompatible class type.
import type { TokenManager } from '@termlnk/auth-core/services/token-manager.service.ts';
import type { ILogService, LogLevel } from '@termlnk/core';
import type { ISyncMutation } from '@termlnk/sync';
import type { HttpFetchFn, HttpWebSocketCtor, IHttpWebSocket } from '../services/http-transport.service';
import { Buffer } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpSyncTransportService } from '../services/http-transport.service';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

class FakeTokenManager {
  token: string | null = 'fake-access-token';
  async getAccessToken(): Promise<string | null> {
    return this.token;
  }
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

class FakeWebSocket implements IHttpWebSocket {
  url: string;
  protocols: string[] | undefined;
  sentMessages: string[] = [];
  closeCalls: { code?: number; reason?: string }[] = [];

  private _listeners: Map<string, Array<(event: any) => void>> = new Map();

  constructor(url: string, protocols?: string[]) {
    this.url = url;
    this.protocols = protocols;
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason });
    this._fire('close', {});
  }

  addEventListener(type: string, listener: (event: any) => void): void {
    const list = this._listeners.get(type) ?? [];
    list.push(listener);
    this._listeners.set(type, list);
  }

  // Test helpers
  _fire(type: string, event: unknown): void {
    for (const l of this._listeners.get(type) ?? []) {
      l(event);
    }
  }
}

describe('HttpSyncTransportService — JSON wire format', () => {
  let logService: NoopLogService;
  let tokenManager: FakeTokenManager;

  beforeEach(() => {
    logService = new NoopLogService();
    tokenManager = new FakeTokenManager();
  });

  afterEach(() => {
    // nothing
  });

  it('push serializes Uint8Array payloads as base64 and attaches Bearer auth', async () => {
    const { fetch, calls } = makeFakeFetch({
      status: 200,
      json: { accepted: [1], rejected: [], lastServerVersion: 5 },
    });
    const transport = new HttpSyncTransportService(
      { baseUrl: 'https://cloud.example/v1', fetchFn: fetch },
      tokenManager as unknown as TokenManager,
      logService
    );

    const mutation: ISyncMutation = {
      id: 1,
      resource: 'host',
      op: 'upsert',
      entityId: 'h1',
      payload: new Uint8Array([1, 2, 3, 0xFF]),
      baseVersion: null,
      createdAt: 1_700_000_000_000,
    };

    const resp = await transport.push({ clientId: 'client-A', mutations: [mutation] });

    expect(resp.accepted).toEqual([1]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://cloud.example/v1/sync/push');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers?.Authorization).toBe('Bearer fake-access-token');
    const body = JSON.parse(calls[0].init.body!);
    expect(body.clientId).toBe('client-A');
    expect(body.mutations[0].payload).toBe(Buffer.from([1, 2, 3, 0xFF]).toString('base64'));
    transport.dispose();
  });

  it('pull deserializes base64 patch payloads back to Uint8Array', async () => {
    const remoteBytes = new Uint8Array([0xAA, 0xBB, 0xCC]);
    const { fetch } = makeFakeFetch({
      status: 200,
      json: {
        cursor: 'c-2',
        patch: [{
          op: 'put',
          resource: 'host',
          entityId: 'h1',
          payload: Buffer.from(remoteBytes).toString('base64'),
          version: 5,
        }],
        lastMutationId: 0,
      },
    });
    const transport = new HttpSyncTransportService(
      { baseUrl: 'https://cloud.example/v1', fetchFn: fetch },
      tokenManager as unknown as TokenManager,
      logService
    );

    const resp = await transport.pull({ clientId: 'client-A', resource: 'host', cursor: 'c-1' });

    expect(resp.cursor).toBe('c-2');
    expect(resp.patch).toHaveLength(1);
    expect(resp.patch[0].payload).toEqual(remoteBytes);
    transport.dispose();
  });

  it('throws unauthenticated when TokenManager returns null', async () => {
    tokenManager.token = null;
    const { fetch } = makeFakeFetch({ status: 200, json: {} });
    const transport = new HttpSyncTransportService(
      { baseUrl: 'https://cloud.example/v1', fetchFn: fetch },
      tokenManager as unknown as TokenManager,
      logService
    );

    await expect(transport.push({ clientId: 'c', mutations: [] }))
      .rejects
      .toThrow(/unauthenticated/i);
    transport.dispose();
  });

  it('throws on non-2xx HTTP responses', async () => {
    const { fetch } = makeFakeFetch({ status: 500, text: 'server boom' });
    const transport = new HttpSyncTransportService(
      { baseUrl: 'https://cloud.example/v1', fetchFn: fetch },
      tokenManager as unknown as TokenManager,
      logService
    );

    await expect(transport.pull({ clientId: 'c', resource: 'host', cursor: null }))
      .rejects
      .toThrow(/500/);
    transport.dispose();
  });

  it('joinUrl strips trailing slash from baseUrl', async () => {
    const { fetch, calls } = makeFakeFetch({
      status: 200,
      json: { accepted: [], rejected: [], lastServerVersion: 0 },
    });
    const transport = new HttpSyncTransportService(
      { baseUrl: 'https://cloud.example/v1/', fetchFn: fetch },
      tokenManager as unknown as TokenManager,
      logService
    );

    await transport.push({ clientId: 'c', mutations: [] });
    expect(calls[0].url).toBe('https://cloud.example/v1/sync/push');
    transport.dispose();
  });

  it('null payload (delete mutation) survives the round-trip as null', async () => {
    const { fetch, calls } = makeFakeFetch({
      status: 200,
      json: { accepted: [9], rejected: [], lastServerVersion: 1 },
    });
    const transport = new HttpSyncTransportService(
      { baseUrl: 'https://cloud.example/v1', fetchFn: fetch },
      tokenManager as unknown as TokenManager,
      logService
    );

    const mutation: ISyncMutation = {
      id: 9,
      resource: 'host',
      op: 'delete',
      entityId: 'h1',
      payload: null,
      baseVersion: 5,
      createdAt: 1_700_000_000_000,
    };
    await transport.push({ clientId: 'c', mutations: [mutation] });
    const body = JSON.parse(calls[0].init.body!);
    expect(body.mutations[0].payload).toBeNull();
    transport.dispose();
  });
});

describe('HttpSyncTransportService — WebSocket', () => {
  let logService: NoopLogService;
  let tokenManager: FakeTokenManager;

  beforeEach(() => {
    logService = new NoopLogService();
    tokenManager = new FakeTokenManager();
  });

  it('connect opens WS with derived wss:// URL and Bearer subprotocol', async () => {
    let socket: FakeWebSocket | null = null;
    const ctor: HttpWebSocketCtor = function (url: string, protocols?: string[]) {
      socket = new FakeWebSocket(url, protocols);
      return socket;
    } as unknown as HttpWebSocketCtor;
    const { fetch } = makeFakeFetch({ status: 200, json: {} });
    const transport = new HttpSyncTransportService(
      { baseUrl: 'https://cloud.example/v1', fetchFn: fetch, webSocketCtor: ctor },
      tokenManager as unknown as TokenManager,
      logService
    );

    await transport.connect();
    expect(socket).not.toBeNull();
    expect(socket!.url).toBe('wss://cloud.example/v1/sync/poke');
    expect(socket!.protocols).toEqual(['Bearer.fake-access-token']);

    transport.dispose();
  });

  it('connected$ flips true on WS open', async () => {
    let socket: FakeWebSocket | null = null;
    const ctor: HttpWebSocketCtor = function (url: string, protocols?: string[]) {
      socket = new FakeWebSocket(url, protocols);
      return socket;
    } as unknown as HttpWebSocketCtor;
    const { fetch } = makeFakeFetch({ status: 200, json: {} });
    const transport = new HttpSyncTransportService(
      { baseUrl: 'http://localhost:8080', fetchFn: fetch, webSocketCtor: ctor },
      tokenManager as unknown as TokenManager,
      logService
    );

    let isConnected = false;
    transport.connected$.subscribe((v) => {
      isConnected = v;
    });

    await transport.connect();
    expect(isConnected).toBe(false);

    socket!._fire('open', {});
    expect(isConnected).toBe(true);

    transport.dispose();
  });

  it('poke message from server is published on poke$', async () => {
    let socket: FakeWebSocket | null = null;
    const ctor: HttpWebSocketCtor = function (url: string, protocols?: string[]) {
      socket = new FakeWebSocket(url, protocols);
      return socket;
    } as unknown as HttpWebSocketCtor;
    const { fetch } = makeFakeFetch({ status: 200, json: {} });
    const transport = new HttpSyncTransportService(
      { baseUrl: 'http://localhost:8080', fetchFn: fetch, webSocketCtor: ctor },
      tokenManager as unknown as TokenManager,
      logService
    );

    const received: unknown[] = [];
    transport.poke$.subscribe((m) => received.push(m));

    await transport.connect();
    socket!._fire('open', {});
    socket!._fire('message', { data: JSON.stringify({ type: 'poke', resource: 'host', cursor: 'srv-12' }) });

    expect(received).toEqual([{ type: 'poke', resource: 'host', cursor: 'srv-12' }]);
    transport.dispose();
  });

  it('disconnect closes the socket and stops reconnecting', async () => {
    let socket: FakeWebSocket | null = null;
    const ctor: HttpWebSocketCtor = function (url: string, protocols?: string[]) {
      socket = new FakeWebSocket(url, protocols);
      return socket;
    } as unknown as HttpWebSocketCtor;
    const { fetch } = makeFakeFetch({ status: 200, json: {} });
    const transport = new HttpSyncTransportService(
      { baseUrl: 'http://localhost:8080', fetchFn: fetch, webSocketCtor: ctor },
      tokenManager as unknown as TokenManager,
      logService
    );

    await transport.connect();
    socket!._fire('open', {});
    await transport.disconnect();

    expect(socket!.closeCalls.length).toBeGreaterThan(0);
  });

  it('connect fails silently when no access token is available', async () => {
    tokenManager.token = null;
    let constructed = 0;
    const ctor: HttpWebSocketCtor = function (_url: string, _protocols?: string[]) {
      constructed++;
      return new FakeWebSocket(_url, _protocols);
    } as unknown as HttpWebSocketCtor;
    const { fetch } = makeFakeFetch({ status: 200, json: {} });
    const transport = new HttpSyncTransportService(
      { baseUrl: 'http://localhost:8080', fetchFn: fetch, webSocketCtor: ctor },
      tokenManager as unknown as TokenManager,
      logService
    );

    await transport.connect();
    expect(constructed).toBe(0); // no socket created when token absent

    transport.dispose();
  });
});
