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
import type { IWebServerConfig } from '../controllers/config.schema';
import { ConfigService, IConfigService, ILogService as ILogServiceId, Injector } from '@termlnk/core';
import { initTRPC } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { TRPC_WS_PATH, WEB_SERVER_PLUGIN_CONFIG_KEY } from '../controllers/config.schema';
import { IStaticFileService, StaticFileService } from '../services/static-file.service';
import { IWebServerService, WebServerService } from '../services/web-server.service';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

interface ITestBed {
  injector: Injector;
  webServerService: IWebServerService;
  origin: string;
  wsUrl: string;
}

function pickPort(): number {
  return 41000 + Math.floor(Math.random() * 5000);
}

function createTestBed(port: number = pickPort()): ITestBed {
  const injector = new Injector();
  injector.add([ILogServiceId, { useClass: NoopLogService }]);
  injector.add([IConfigService, { useClass: ConfigService }]);
  injector.add([IStaticFileService, { useClass: StaticFileService }]);
  injector.add([IWebServerService, { useClass: WebServerService }]);

  const config = injector.get(IConfigService);
  const cfg: IWebServerConfig = { host: '127.0.0.1', port };
  config.setConfig(WEB_SERVER_PLUGIN_CONFIG_KEY, cfg);

  return {
    injector,
    webServerService: injector.get(IWebServerService),
    origin: `http://127.0.0.1:${port}`,
    wsUrl: `ws://127.0.0.1:${port}${TRPC_WS_PATH}`,
  };
}

/**
 * Router exposing one subscription procedure that emits 3 events then completes.
 */
function createSubscriptionRouter() {
  const t = initTRPC.context<{ injector: Injector }>().create();
  return t.router({
    countdown: t.procedure.subscription(() => {
      return observable<{ value: number }>((emit) => {
        let n = 0;
        const interval = setInterval(() => {
          n += 1;
          emit.next({ value: n });
          if (n >= 3) {
            emit.complete();
            clearInterval(interval);
          }
        }, 20);
        return () => clearInterval(interval);
      });
    }),
    greeting: t.procedure.query(() => ({ message: 'hello' })),
  });
}

/**
 * Hand-rolled JSON-RPC equivalent to the tRPC `wsLink`: opens a subscription and
 * collects N data frames. We avoid pulling in @trpc/client just for tests and
 * verify server behaviour at the wire-format level directly.
 *
 * tRPC v11 WebSocket wire format:
 *   client -> server: { id: 1, jsonrpc: '2.0', method: 'subscription', params: { path, input? } }
 *   server -> client: { id: 1, result: { type: 'started' | 'data' | 'stopped', data?: ... } }
 */
async function collectSubscriptionEvents(
  url: string,
  procedurePath: string,
  expectedDataCount: number,
  timeoutMs = 5000
): Promise<{ started: boolean; data: any[]; stopped: boolean }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const data: any[] = [];
    let started = false;
    let stopped = false;
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`subscription timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'subscription',
        params: { path: procedurePath, input: undefined },
      }));
    });

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.id !== 1) {
        return;
      }
      const type = msg.result?.type;
      if (type === 'started') {
        started = true;
      } else if (type === 'data') {
        data.push(msg.result.data);
        if (data.length >= expectedDataCount) {
          // Don't close from the client side — let the server emit 'stopped'.
        }
      } else if (type === 'stopped') {
        stopped = true;
        clearTimeout(timer);
        ws.close();
        resolve({ started, data, stopped });
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

describe('webServerService P7.1b — WebSocket subscription', () => {
  let bed: ITestBed | null = null;

  afterEach(async () => {
    if (bed) {
      await bed.webServerService.stop();
      bed = null;
    }
  });

  it('streams subscription events from started to stopped', { timeout: 10000 }, async () => {
    bed = createTestBed();
    bed.webServerService.setRouter(createSubscriptionRouter() as any);
    await bed.webServerService.start();

    const result = await collectSubscriptionEvents(bed.wsUrl, 'countdown', 3);
    expect(result.started).toBe(true);
    expect(result.stopped).toBe(true);
    expect(result.data.length).toBe(3);
    expect(result.data.map((d: any) => d.value)).toEqual([1, 2, 3]);
  });

  it('rejects WebSocket upgrade on unknown path', { timeout: 5000 }, async () => {
    bed = createTestBed();
    bed.webServerService.setRouter(createSubscriptionRouter() as any);
    await bed.webServerService.start();

    // Unknown path -> upgrade dispatcher must `socket.destroy()` immediately,
    // otherwise an attacker hitting `/random-ws` would hold a TCP connection
    // open indefinitely.
    const ws = new WebSocket(`ws://127.0.0.1:${new URL(bed.origin).port}/unknown-ws`);
    const closed = await new Promise<boolean>((resolve) => {
      ws.on('error', () => resolve(true));
      ws.on('open', () => resolve(false));
    });
    expect(closed).toBe(true);
    expect(ws.readyState).not.toBe(WebSocket.OPEN);
  });

  it('keeps tRPC HTTP query working alongside WebSocket', { timeout: 10000 }, async () => {
    bed = createTestBed();
    bed.webServerService.setRouter(createSubscriptionRouter() as any);
    await bed.webServerService.start();

    const resp = await fetch(`${bed.origin}/trpc/greeting`);
    expect(resp.ok).toBe(true);
    const body: any = await resp.json();
    expect(body?.result?.data?.message ?? body?.message).toBe('hello');
  });

  it('cleans up active WebSocket clients on stop()', { timeout: 10000 }, async () => {
    bed = createTestBed();
    bed.webServerService.setRouter(createSubscriptionRouter() as any);
    await bed.webServerService.start();

    const ws = new WebSocket(bed.wsUrl);
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
    });
    expect(ws.readyState).toBe(WebSocket.OPEN);

    await bed.webServerService.stop();

    // After server.stop() the active client should be terminated.
    await new Promise<void>((resolve) => {
      if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        resolve();
        return;
      }
      ws.on('close', () => resolve());
    });
    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });

  it('broadcastReconnect sends reconnect notification to all clients', { timeout: 10000 }, async () => {
    bed = createTestBed();
    bed.webServerService.setRouter(createSubscriptionRouter() as any);
    await bed.webServerService.start();

    const ws = new WebSocket(bed.wsUrl);
    const reconnectMsgs: any[] = [];

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
    });

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.method === 'reconnect') {
        reconnectMsgs.push(msg);
      }
    });

    bed.webServerService.broadcastReconnect();

    // Give the server a beat to flush the reconnect notification.
    await new Promise((r) => setTimeout(r, 50));
    expect(reconnectMsgs.length).toBeGreaterThanOrEqual(1);

    ws.close();
  });
});
