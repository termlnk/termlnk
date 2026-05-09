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
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService, IConfigService, ILogService as ILogServiceId, Injector } from '@termlnk/core';
import { initTRPC } from '@trpc/server';
import { afterEach, describe, expect, it } from 'vitest';
import { WEB_SERVER_PLUGIN_CONFIG_KEY } from '../controllers/config.schema';
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
  staticDir: string;
  origin(): string;
}

function pickPort(): number {
  // Random port in 41000..46000 to avoid collisions with common services /
  // parallel test runs. Letting the OS pick (port 0) would require fishing
  // the bound port back out of the listener, which complicates the test bed.
  return 41000 + Math.floor(Math.random() * 5000);
}

function createTestBed(opts: { staticRoot?: string; port?: number } = {}): ITestBed {
  const port = opts.port ?? pickPort();
  const injector = new Injector();
  injector.add([ILogServiceId, { useClass: NoopLogService }]);
  injector.add([IConfigService, { useClass: ConfigService }]);
  injector.add([IStaticFileService, { useClass: StaticFileService }]);
  injector.add([IWebServerService, { useClass: WebServerService }]);

  const config = injector.get(IConfigService);
  const cfg: IWebServerConfig = { host: '127.0.0.1', port, staticRoot: opts.staticRoot };
  config.setConfig(WEB_SERVER_PLUGIN_CONFIG_KEY, cfg);

  return {
    injector,
    webServerService: injector.get(IWebServerService),
    staticDir: opts.staticRoot ?? '',
    origin: () => `http://127.0.0.1:${port}`,
  };
}

function createMinimalRouter() {
  const t = initTRPC.context<{ injector: Injector }>().create();
  return t.router({
    greeting: t.procedure.query(() => ({ message: 'hello from web-server' })),
  });
}

describe('webServerService P7.1a', () => {
  let bed: ITestBed | null = null;

  afterEach(async () => {
    if (bed) {
      await bed.webServerService.stop();
      bed = null;
    }
  });

  it('refuses to start without a router (misuse — state stays stopped)', async () => {
    bed = createTestBed();
    await expect(bed.webServerService.start()).rejects.toThrow(/setRouter/);
    // Missing router is caller misuse, distinct from listen failure (port
    // conflict etc.). Listen failure flips state to 'error'; misuse throws
    // synchronously while leaving state at 'stopped' so caller can recover.
    expect(bed.webServerService.getState().status).toBe('stopped');
  });

  it('handles tRPC query over HTTP', async () => {
    bed = createTestBed();
    bed.webServerService.setRouter(createMinimalRouter() as any);
    await bed.webServerService.start();

    expect(bed.webServerService.getState().status).toBe('running');

    const resp = await fetch(`${bed.origin()}/trpc/greeting`);
    expect(resp.ok).toBe(true);
    const body: any = await resp.json();
    // tRPC v11 batch response wrapping
    expect(body?.result?.data?.message ?? body?.message).toBe('hello from web-server');
  });

  it('serves static SPA from staticRoot', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'web-server-static-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>spa</title>');
    writeFileSync(join(dir, 'app.js'), 'console.log(1);');

    bed = createTestBed({ staticRoot: dir });
    bed.webServerService.setRouter(createMinimalRouter() as any);
    await bed.webServerService.start();

    const resp = await fetch(`${bed.origin()}/app.js`);
    expect(resp.status).toBe(200);
    expect(resp.headers.get('content-type')).toContain('javascript');
    const body = await resp.text();
    expect(body).toContain('console.log(1)');
  });

  it('falls back to index.html for unknown SPA history paths', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'web-server-fallback-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>spa</title>');

    bed = createTestBed({ staticRoot: dir });
    bed.webServerService.setRouter(createMinimalRouter() as any);
    await bed.webServerService.start();

    const resp = await fetch(`${bed.origin()}/some/spa/route`);
    expect(resp.status).toBe(200);
    expect(resp.headers.get('content-type')).toContain('text/html');
    const body = await resp.text();
    expect(body).toContain('spa');
  });

  it('does NOT fallback to index.html for missing assets with extension', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'web-server-noext-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>spa</title>');

    bed = createTestBed({ staticRoot: dir });
    bed.webServerService.setRouter(createMinimalRouter() as any);
    await bed.webServerService.start();

    // A missing `.png` must not be served the index.html body, otherwise the
    // browser would try to render HTML as an image and break the page.
    const resp = await fetch(`${bed.origin()}/missing.png`);
    expect(resp.status).toBe(404);
  });

  it('rejects path-traversal attempts with 403', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'web-server-traversal-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>spa</title>');

    bed = createTestBed({ staticRoot: dir });
    bed.webServerService.setRouter(createMinimalRouter() as any);
    await bed.webServerService.start();

    const resp = await fetch(`${bed.origin()}/..%2F..%2Fetc%2Fpasswd`);
    expect(resp.status).toBe(403);
  });

  it('returns 404 when no staticRoot configured and no tRPC match', async () => {
    bed = createTestBed();
    bed.webServerService.setRouter(createMinimalRouter() as any);
    await bed.webServerService.start();

    const resp = await fetch(`${bed.origin()}/some/random`);
    expect(resp.status).toBe(404);
  });

  it('mountRouteHandler handler runs before tRPC and SPA fallback', async () => {
    bed = createTestBed();
    bed.webServerService.setRouter(createMinimalRouter() as any);
    bed.webServerService.mountRouteHandler('/__termlnk-web', (_req, res) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain');
      res.end('not implemented');
      return true;
    });
    await bed.webServerService.start();

    const resp = await fetch(`${bed.origin()}/__termlnk-web/login/init`);
    expect(resp.status).toBe(200);
    expect(await resp.text()).toBe('not implemented');
  });

  it('start is idempotent when already running', async () => {
    bed = createTestBed();
    bed.webServerService.setRouter(createMinimalRouter() as any);
    await bed.webServerService.start();
    await bed.webServerService.start(); // second call no-op
    expect(bed.webServerService.getState().status).toBe('running');
  });

  it('stop transitions to stopped', async () => {
    bed = createTestBed();
    bed.webServerService.setRouter(createMinimalRouter() as any);
    await bed.webServerService.start();
    await bed.webServerService.stop();
    expect(bed.webServerService.getState().status).toBe('stopped');

    // stop on stopped is no-op
    await bed.webServerService.stop();
    expect(bed.webServerService.getState().status).toBe('stopped');
  });
});
