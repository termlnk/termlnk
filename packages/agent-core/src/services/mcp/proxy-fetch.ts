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
import type { SocksClientOptions } from 'socks';
import * as tls from 'node:tls';
import { SocksClient } from 'socks';
import { Agent, ProxyAgent, fetch as undiciFetch } from 'undici';

export type FetchLike = (url: string | URL, init?: RequestInit) => Promise<Response>;

/**
 * Handle over a proxy-routed fetch. The underlying undici dispatcher holds
 * native sockets, so callers MUST call `close()` when done (or when the proxy
 * config changes) — dropping the handle without closing leaks the dispatcher.
 */
export interface IProxyFetchHandle {
  readonly fetch: FetchLike;
  close: () => Promise<void>;
}

export function createProxyFetch(proxy: IProxy): IProxyFetchHandle {
  const dispatcher = proxy.type === 'socks5'
    ? _createSocks5Dispatcher(proxy)
    : _createHttpProxyDispatcher(proxy);

  return {
    fetch: (url, init) => {
      // Standard RequestInit body types differ slightly from undici's internal types
      return undiciFetch(url, { ...init, dispatcher } as never) as unknown as Promise<Response>;
    },
    close: () => dispatcher.close(),
  };
}

/** Structural equality on proxy settings, used to decide dispatcher reuse. */
export function proxyConfigEqual(a: IProxy, b: IProxy): boolean {
  return a.type === b.type
    && a.host === b.host
    && a.port === b.port
    && a.username === b.username
    && a.password === b.password
    && a.enabled === b.enabled;
}

export function createProxyEnvironment(proxy: IProxy): Record<string, string> {
  const proxyUrl = _createProxyUrl(proxy);

  return {
    HTTP_PROXY: proxyUrl,
    HTTPS_PROXY: proxyUrl,
    ALL_PROXY: proxyUrl,
    http_proxy: proxyUrl,
    https_proxy: proxyUrl,
    all_proxy: proxyUrl,
  };
}

function _createHttpProxyDispatcher(proxy: IProxy): ProxyAgent {
  return new ProxyAgent(_createProxyUrl(proxy));
}

function _defaultPort(protocol?: string): number {
  return protocol === 'https:' ? 443 : 80;
}

function _createSocks5Dispatcher(proxy: IProxy): Agent {
  return new Agent({
    connect(opts, cb) {
      const { hostname, port, protocol } = opts as { hostname?: string; port?: number | string; protocol?: string };
      const destinationPort = Number(port) || _defaultPort(protocol);

      const socksOptions: SocksClientOptions = {
        proxy: {
          host: proxy.host,
          port: proxy.port,
          type: 5,
          userId: proxy.username,
          password: proxy.password,
        },
        command: 'connect',
        destination: {
          host: hostname!,
          port: destinationPort,
        },
      };

      SocksClient.createConnection(socksOptions).then(({ socket }) => {
        if (protocol === 'https:') {
          const tlsSocket = tls.connect({
            socket,
            servername: hostname!,
          });
          tlsSocket.once('secureConnect', () => cb(null, tlsSocket));
          tlsSocket.once('error', (err) => cb(err, null));
        } else {
          cb(null, socket);
        }
      }).catch((err) => {
        cb(err as Error, null);
      });
    },
  });
}

function _createProxyUrl(proxy: IProxy): string {
  const auth = proxy.username
    ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password ?? '')}@`
    : '';
  const protocol = proxy.type === 'socks5' ? 'socks5h' : 'http';
  return `${protocol}://${auth}${proxy.host}:${proxy.port}`;
}
