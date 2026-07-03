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
import { describe, expect, it } from 'vitest';
import { createProxyFetch, proxyConfigEqual } from './proxy-fetch';

function makeProxy(overrides: Partial<IProxy> = {}): IProxy {
  return {
    enabled: true,
    type: 'http',
    host: '127.0.0.1',
    port: 8080,
    ...overrides,
  };
}

describe('createProxyFetch', () => {
  it('returns a closable handle for http proxies', async () => {
    const handle = createProxyFetch(makeProxy());

    expect(typeof handle.fetch).toBe('function');
    await handle.close();
  });

  it('returns a closable handle for socks5 proxies', async () => {
    const handle = createProxyFetch(makeProxy({ type: 'socks5', port: 1080 }));

    expect(typeof handle.fetch).toBe('function');
    await handle.close();
  });
});

describe('proxyConfigEqual', () => {
  it('matches identical configs', () => {
    expect(proxyConfigEqual(makeProxy(), makeProxy())).toBe(true);
  });

  it('detects any field difference', () => {
    const base = makeProxy();
    expect(proxyConfigEqual(base, makeProxy({ type: 'socks5' }))).toBe(false);
    expect(proxyConfigEqual(base, makeProxy({ host: 'proxy.local' }))).toBe(false);
    expect(proxyConfigEqual(base, makeProxy({ port: 9090 }))).toBe(false);
    expect(proxyConfigEqual(base, makeProxy({ username: 'user' }))).toBe(false);
    expect(proxyConfigEqual(base, makeProxy({ password: 'secret' }))).toBe(false);
    expect(proxyConfigEqual(base, makeProxy({ enabled: false }))).toBe(false);
  });
});
