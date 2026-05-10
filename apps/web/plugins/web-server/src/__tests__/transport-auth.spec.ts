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
import { IWebSessionService } from '../services/web-session.service';
import { FakeWebSessionService } from './test-helpers';

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

function createTestBed(): ITestBed {
  const port = pickPort();
  const injector = new Injector();
  injector.add([ILogServiceId, { useClass: NoopLogService }]);
  injector.add([IConfigService, { useClass: ConfigService }]);
  injector.add([IStaticFileService, { useClass: StaticFileService }]);
  // 'cookie-required' mirrors the production WebSessionService contract:
  // accept exactly the cookie value our tests will plant, reject everything
  // else. That's the only way to verify the gate without standing up the full
  // Argon2id login flow.
  injector.add([IWebSessionService, { useValue: new FakeWebSessionService('cookie-required') }]);
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

function createTestRouter() {
  const t = initTRPC.context<{ injector: Injector }>().create();
  return t.router({
    greeting: t.procedure.query(() => ({ message: 'authorized hello' })),
    countdown: t.procedure.subscription(() => observable<{ value: number }>((emit) => {
      let n = 0;
      const id = setInterval(() => {
        n += 1;
        emit.next({ value: n });
        if (n >= 2) {
          emit.complete();
          clearInterval(id);
        }
      }, 20);
      return () => clearInterval(id);
    })),
  });
}

describe('webServerService P7.5 — cookie-based transport authentication', () => {
  let bed: ITestBed | null = null;

  afterEach(async () => {
    if (bed) {
      await bed.webServerService.stop();
      bed = null;
    }
  });

  it('rejects /trpc HTTP query with 401 when no session cookie is present', { timeout: 10000 }, async () => {
    bed = createTestBed();
    bed.webServerService.setRouter(createTestRouter() as any);
    await bed.webServerService.start();

    const resp = await fetch(`${bed.origin}/trpc/greeting`);
    expect(resp.status).toBe(401);
  });

  it('rejects /trpc HTTP query with 401 when the cookie is wrong', { timeout: 10000 }, async () => {
    bed = createTestBed();
    bed.webServerService.setRouter(createTestRouter() as any);
    await bed.webServerService.start();

    const resp = await fetch(`${bed.origin}/trpc/greeting`, {
      headers: { cookie: 'termlnk-web-sid=stolen-or-stale' },
    });
    expect(resp.status).toBe(401);
  });

  it('lets /trpc HTTP query through with a valid session cookie', { timeout: 10000 }, async () => {
    bed = createTestBed();
    bed.webServerService.setRouter(createTestRouter() as any);
    await bed.webServerService.start();

    const resp = await fetch(`${bed.origin}/trpc/greeting`, {
      headers: { cookie: 'termlnk-web-sid=test-session' },
    });
    expect(resp.status).toBe(200);
    const body: any = await resp.json();
    expect(body?.result?.data?.message ?? body?.message).toBe('authorized hello');
  });

  it('rejects WebSocket subscription upgrade without a session cookie', { timeout: 10000 }, async () => {
    bed = createTestBed();
    bed.webServerService.setRouter(createTestRouter() as any);
    await bed.webServerService.start();

    // The factory writes a 401 status line then destroys the socket; the `ws`
    // client treats that as a handshake error and emits `error`.
    const ws = new WebSocket(bed.wsUrl);
    const opened = await new Promise<boolean>((resolve) => {
      ws.on('error', () => resolve(false));
      ws.on('open', () => resolve(true));
    });
    expect(opened).toBe(false);
    expect(ws.readyState).not.toBe(WebSocket.OPEN);
  });

  it('accepts WebSocket subscription upgrade when the cookie is valid', { timeout: 10000 }, async () => {
    bed = createTestBed();
    bed.webServerService.setRouter(createTestRouter() as any);
    await bed.webServerService.start();

    const ws = new WebSocket(bed.wsUrl, { headers: { cookie: 'termlnk-web-sid=test-session' } });
    const opened = await new Promise<boolean>((resolve) => {
      ws.on('error', () => resolve(false));
      ws.on('open', () => resolve(true));
    });
    expect(opened).toBe(true);

    // And the subscription should actually flow data, not just hang half-open.
    const messages = await new Promise<any[]>((resolve, reject) => {
      const seen: any[] = [];
      const timer = setTimeout(() => reject(new Error('subscription timeout')), 5000);
      ws.send(JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'subscription',
        params: { path: 'countdown', input: undefined },
      }));
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.id !== 1) {
          return;
        }
        seen.push(msg);
        if (msg.result?.type === 'stopped') {
          clearTimeout(timer);
          ws.close();
          resolve(seen);
        }
      });
    });

    const dataFrames = messages.filter((m) => m.result?.type === 'data');
    expect(dataFrames.map((m) => m.result.data.value)).toEqual([1, 2]);
  });
});
