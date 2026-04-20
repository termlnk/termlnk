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

import type { IDisposable } from '@termlnk/core';
import type { IProxy } from '@termlnk/terminal';
import type { Socket } from 'node:net';
import type { Observable } from 'rxjs';
import type { SocksClientOptions } from 'socks';
import { Buffer } from 'node:buffer';
import * as http from 'node:http';
import { DisposableCollection, isValidIP as isIPAddress, toDisposable } from '@termlnk/core';
import { ProxySocketStatus } from '@termlnk/rpc';
import { BehaviorSubject, Subject } from 'rxjs';
import { SocksClient } from 'socks';

export interface IProxyConnectOptions {
  proxy: IProxy;
  destination: {
    host: string;
    port: number;
  };
  timeout?: number;
}

export interface IProxyErrorEvent {
  err: Error;
}

export interface IProxySocket extends IDisposable {
  readonly id: string;

  readonly status$: Observable<ProxySocketStatus>;
  readonly status: ProxySocketStatus;

  connect(options: IProxyConnectOptions): Promise<Socket>;

  readonly error$: Observable<IProxyErrorEvent>;
}

export function createProxySocket(id: string): IProxySocket {
  const disposables = new DisposableCollection();
  const _status$ = new BehaviorSubject<ProxySocketStatus>(ProxySocketStatus.IDLE);
  const _error$ = new Subject<IProxyErrorEvent>();

  const proxySocket: IProxySocket = {
    id,
    status$: _status$.asObservable(),
    get status() {
      return _status$.getValue();
    },

    connect: async (options: IProxyConnectOptions): Promise<Socket> => {
      _status$.next(ProxySocketStatus.CONNECTING);

      let socket: Socket;
      const { proxy } = options;
      if (proxy.type === 'socks5') {
        socket = await connectSocks5Proxy(options);
      } else if (proxy.type === 'http') {
        socket = await connectHttpProxy(options);
      } else {
        _status$.next(ProxySocketStatus.ERROR);
        throw new Error('Invalid proxy');
      }

      _status$.next(ProxySocketStatus.CONNECTED);

      disposables.add(toDisposable(() => {
        socket.destroy();
      }));

      return socket;
    },

    error$: _error$.asObservable(),

    dispose() {
      disposables.dispose();
      _status$.complete();
      _error$.complete();
    },
  };

  return proxySocket;
}

export async function connectSocks5Proxy(options: IProxyConnectOptions): Promise<Socket> {
  const { proxy, destination, timeout } = options;

  const socksOptions: SocksClientOptions = {
    proxy: {
      port: proxy.port,
      type: 5,
      userId: proxy.username,
      password: proxy.password,
    },
    command: 'connect' as const,
    timeout,
    destination: {
      host: destination.host,
      port: destination.port,
    },
  };
  if (isIPAddress(proxy.host)) {
    socksOptions.proxy.ipaddress = proxy.host;
  } else {
    socksOptions.proxy.host = proxy.host;
  }

  const client = await SocksClient.createConnection(socksOptions);
  return client.socket;
}

export function connectHttpProxy(options: IProxyConnectOptions): Promise<Socket> {
  const { proxy, destination, timeout } = options;

  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};

    if (proxy.username) {
      const auth = Buffer.from(`${proxy.username}:${proxy.password ?? ''}`).toString('base64');
      headers['Proxy-Authorization'] = `Basic ${auth}`;
    }

    const opts: http.RequestOptions = {
      agent: false,
      hostname: proxy.host,
      port: proxy.port,
      path: `${destination.host}:${destination.port}`,
      method: 'CONNECT',
      timeout,
      headers,
    };
    const client = http.request(opts);
    client.on('connect', (_res, socket) => {
      resolve(socket);
    });
    client.on('error', (err) => {
      reject(new Error(`HTTP proxy connection failed: ${err.message}`));
    });
    client.on('timeout', () => {
      reject(new Error('HTTP proxy connection timed out'));
    });
    client.end();
  });
}
