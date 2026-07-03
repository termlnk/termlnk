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

import type { IProxy } from '@termlnk/terminal';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NETWORK_PLUGIN_CONFIG_KEY } from '@termlnk/network';
import { NodeProxyFetchProvider } from './node-proxy-fetch-provider';

const mocks = vi.hoisted(() => {
  const handles: Array<{ fetch: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }> = [];
  const createProxyFetch = vi.fn(() => {
    const handle = { fetch: vi.fn(), close: vi.fn(() => Promise.resolve()) };
    handles.push(handle);
    return handle;
  });
  return { handles, createProxyFetch };
});

vi.mock('../mcp/proxy-fetch', () => ({
  createProxyFetch: mocks.createProxyFetch,
  proxyConfigEqual: (a: IProxy, b: IProxy) =>
    a.type === b.type
    && a.host === b.host
    && a.port === b.port
    && a.username === b.username
    && a.password === b.password
    && a.enabled === b.enabled,
}));

const noopLog = {
  debug: () => {},
  log: () => {},
  warn: () => {},
  error: () => {},
  deprecate: () => {},
  setLogLevel: () => {},
};

function makeProxy(overrides: Partial<IProxy> = {}): IProxy {
  return {
    enabled: true,
    type: 'http',
    host: '127.0.0.1',
    port: 8080,
    ...overrides,
  };
}

function makeRepoStub(initialProxy: IProxy | null): any {
  return {
    changed$: new Subject<{ key: string; subKey?: string }>(),
    getField: vi.fn(async () => initialProxy),
  };
}

describe('NodeProxyFetchProvider dispatcher lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.handles.length = 0;
    mocks.createProxyFetch.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('closes the previous dispatcher when the proxy config changes', async () => {
    const repo = makeRepoStub(makeProxy());
    const provider = new NodeProxyFetchProvider(repo, noopLog as never);
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.handles.length).toBe(1);

    repo.getField = vi.fn(async () => makeProxy({ port: 9090 }));
    repo.changed$.next({ key: NETWORK_PLUGIN_CONFIG_KEY, subKey: 'proxy' });
    await vi.advanceTimersByTimeAsync(250);

    expect(mocks.handles.length).toBe(2);
    expect(mocks.handles[0]!.close).toHaveBeenCalledTimes(1);
    expect(mocks.handles[1]!.close).not.toHaveBeenCalled();

    provider.dispose();
  });

  it('reuses the dispatcher when the proxy config is unchanged', async () => {
    const repo = makeRepoStub(makeProxy());
    const provider = new NodeProxyFetchProvider(repo, noopLog as never);
    await vi.advanceTimersByTimeAsync(0);

    repo.changed$.next({ key: NETWORK_PLUGIN_CONFIG_KEY, subKey: 'proxy' });
    await vi.advanceTimersByTimeAsync(250);

    expect(mocks.handles.length).toBe(1);
    expect(mocks.handles[0]!.close).not.toHaveBeenCalled();

    provider.dispose();
  });

  it('closes the dispatcher when the proxy is disabled', async () => {
    const repo = makeRepoStub(makeProxy());
    const provider = new NodeProxyFetchProvider(repo, noopLog as never);
    await vi.advanceTimersByTimeAsync(0);

    repo.getField = vi.fn(async () => makeProxy({ enabled: false }));
    repo.changed$.next({ key: NETWORK_PLUGIN_CONFIG_KEY, subKey: 'proxy' });
    await vi.advanceTimersByTimeAsync(250);

    expect(mocks.handles.length).toBe(1);
    expect(mocks.handles[0]!.close).toHaveBeenCalledTimes(1);

    provider.dispose();
  });

  it('closes the last dispatcher on dispose', async () => {
    const repo = makeRepoStub(makeProxy());
    const provider = new NodeProxyFetchProvider(repo, noopLog as never);
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.handles.length).toBe(1);

    provider.dispose();

    expect(mocks.handles[0]!.close).toHaveBeenCalledTimes(1);
  });
});
