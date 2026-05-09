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
import { TERMLNK_WEB_AUTH_PATH_PREFIX, WEB_SERVER_PLUGIN_CONFIG_KEY } from '../controllers/config.schema';
import { IMasterKeyHolderService, MasterKeyHolderService } from '../services/master-key-holder.service';
import { IStaticFileService, StaticFileService } from '../services/static-file.service';
import { IWebServerService, WebServerService } from '../services/web-server.service';
import { IWebSessionService, SESSION_COOKIE_NAME, WebSessionService } from '../services/web-session.service';
import { createAuthRouteHandler } from '../trpc/auth-routes';

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
  holder: IMasterKeyHolderService;
  sessionService: IWebSessionService;
  origin: string;
}

function pickPort(): number {
  return 41000 + Math.floor(Math.random() * 5000);
}

function createMinimalRouter() {
  const t = initTRPC.context<{ injector: Injector }>().create();
  return t.router({
    ping: t.procedure.query(() => ({ ok: true })),
  });
}

async function setupBed(opts: { masterPassword?: string; masterPasswordFile?: string; sessionIdleTimeoutMs?: number } = {}): Promise<ITestBed> {
  const port = pickPort();
  const injector = new Injector();
  injector.add([ILogServiceId, { useClass: NoopLogService }]);
  injector.add([IConfigService, { useClass: ConfigService }]);
  injector.add([IStaticFileService, { useClass: StaticFileService }]);
  injector.add([IWebServerService, { useClass: WebServerService }]);
  injector.add([IMasterKeyHolderService, { useClass: MasterKeyHolderService }]);
  injector.add([IWebSessionService, { useClass: WebSessionService }]);

  const config = injector.get(IConfigService);
  const cfg: IWebServerConfig = {
    host: '127.0.0.1',
    port,
    masterPassword: opts.masterPassword,
    masterPasswordFile: opts.masterPasswordFile,
    masterPasswordEnv: 'TERMLNK_TEST_PWD_NONEXISTENT',
    sessionIdleTimeoutMs: opts.sessionIdleTimeoutMs,
  };
  config.setConfig(WEB_SERVER_PLUGIN_CONFIG_KEY, cfg);

  const webServerService = injector.get(IWebServerService);
  const holder = injector.get(IMasterKeyHolderService);
  const sessionService = injector.get(IWebSessionService);

  webServerService.setRouter(createMinimalRouter() as any);
  webServerService.mountRouteHandler(
    TERMLNK_WEB_AUTH_PATH_PREFIX,
    createAuthRouteHandler({
      masterKeyHolder: holder,
      sessionService,
      logService: injector.get(ILogServiceId),
    })
  );
  await webServerService.start();

  return {
    injector,
    webServerService,
    holder,
    sessionService,
    origin: `http://127.0.0.1:${port}`,
  };
}

describe('p7.1c — auth routes (login / logout / status, session cookie, idle timeout)', () => {
  let bed: ITestBed | null = null;

  afterEach(async () => {
    if (bed) {
      await bed.webServerService.stop();
      bed = null;
    }
  });

  it('reports holder error before initialize when no source is configured', { timeout: 15000 }, async () => {
    bed = await setupBed();
    // Holder has not been initialised yet — still pending.
    const status1 = await fetch(`${bed.origin}${TERMLNK_WEB_AUTH_PATH_PREFIX}/status`).then((r) => r.json()) as any;
    expect(status1.holderStatus).toBe('pending');
    expect(status1.authenticated).toBe(false);

    // Initialize: must fail because no env / file / literal supplied.
    await expect(bed.holder.initialize()).rejects.toThrow(/no master password source/);

    const status2 = await fetch(`${bed.origin}${TERMLNK_WEB_AUTH_PATH_PREFIX}/status`).then((r) => r.json()) as any;
    expect(status2.holderStatus).toBe('error');
    expect(status2.holderError).toMatch(/no master password source/);
  });

  it('login fails with invalid_password before any successful login', { timeout: 30000 }, async () => {
    bed = await setupBed({ masterPassword: 'correct-horse-battery-staple' });
    await bed.holder.initialize();

    const resp = await fetch(`${bed.origin}${TERMLNK_WEB_AUTH_PATH_PREFIX}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong' }),
    });
    expect(resp.status).toBe(401);
    const body: any = await resp.json();
    expect(body.error).toBe('invalid_password');
    // No cookie was issued for a failed login.
    expect(resp.headers.get('set-cookie')).toBeNull();
  });

  it('login succeeds with the configured master password and sets a session cookie', { timeout: 30000 }, async () => {
    bed = await setupBed({ masterPassword: 'correct-horse-battery-staple' });
    await bed.holder.initialize();

    const resp = await fetch(`${bed.origin}${TERMLNK_WEB_AUTH_PATH_PREFIX}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-horse-battery-staple' }),
    });
    expect(resp.status).toBe(200);
    const body: any = await resp.json();
    expect(body.ok).toBe(true);

    const setCookie = resp.headers.get('set-cookie');
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
  });

  it('status reports authenticated:true after login + cookie round trip', { timeout: 30000 }, async () => {
    bed = await setupBed({ masterPassword: 'correct-horse-battery-staple' });
    await bed.holder.initialize();

    const loginResp = await fetch(`${bed.origin}${TERMLNK_WEB_AUTH_PATH_PREFIX}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-horse-battery-staple' }),
    });
    const cookie = extractSessionCookie(loginResp.headers.get('set-cookie')!);
    expect(cookie).not.toBe('');

    const statusResp = await fetch(`${bed.origin}${TERMLNK_WEB_AUTH_PATH_PREFIX}/status`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${cookie}` },
    });
    const status: any = await statusResp.json();
    expect(status.holderStatus).toBe('unlocked');
    expect(status.authenticated).toBe(true);
  });

  it('logout clears the session and subsequent status comes back unauthenticated', { timeout: 30000 }, async () => {
    bed = await setupBed({ masterPassword: 'correct-horse-battery-staple' });
    await bed.holder.initialize();

    const loginResp = await fetch(`${bed.origin}${TERMLNK_WEB_AUTH_PATH_PREFIX}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-horse-battery-staple' }),
    });
    const cookie = extractSessionCookie(loginResp.headers.get('set-cookie')!);

    const logoutResp = await fetch(`${bed.origin}${TERMLNK_WEB_AUTH_PATH_PREFIX}/logout`, {
      method: 'POST',
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${cookie}` },
    });
    expect(logoutResp.status).toBe(200);

    const statusResp = await fetch(`${bed.origin}${TERMLNK_WEB_AUTH_PATH_PREFIX}/status`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${cookie}` },
    });
    const status: any = await statusResp.json();
    expect(status.authenticated).toBe(false);
  });

  it('session is evicted after the configured idle timeout', { timeout: 30000 }, async () => {
    bed = await setupBed({
      masterPassword: 'correct-horse-battery-staple',
      sessionIdleTimeoutMs: 80,
    });
    await bed.holder.initialize();

    const loginResp = await fetch(`${bed.origin}${TERMLNK_WEB_AUTH_PATH_PREFIX}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-horse-battery-staple' }),
    });
    const cookie = extractSessionCookie(loginResp.headers.get('set-cookie')!);

    // Wait past the idle timeout — `touch` rejects expired sessions on next request.
    await new Promise((r) => setTimeout(r, 150));

    const statusResp = await fetch(`${bed.origin}${TERMLNK_WEB_AUTH_PATH_PREFIX}/status`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${cookie}` },
    });
    const status: any = await statusResp.json();
    expect(status.authenticated).toBe(false);
  });

  it('reads master password from a file when masterPasswordFile is set', { timeout: 30000 }, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'termlnk-web-pwd-'));
    const file = join(dir, 'master_password');
    writeFileSync(file, 'file-sourced-password\n');

    bed = await setupBed({ masterPasswordFile: file });
    await bed.holder.initialize();

    // Newline is trimmed when reading the file.
    const ok = await bed.holder.verifyAccess('file-sourced-password');
    expect(ok).toBe(true);
  });

  it('rejects login bodies larger than 4 KiB', { timeout: 30000 }, async () => {
    bed = await setupBed({ masterPassword: 'correct-horse-battery-staple' });
    await bed.holder.initialize();

    const huge = 'x'.repeat(5000);
    // Server's `req.destroy()` closes the socket mid-request; undici surfaces
    // that as a SocketError. A graceful 400 is also acceptable. Either way,
    // the oversize body must not produce a successful login.
    let socketClosed = false;
    let responseStatus: number | null = null;
    try {
      const resp = await fetch(`${bed.origin}${TERMLNK_WEB_AUTH_PATH_PREFIX}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: huge }),
      });
      responseStatus = resp.status;
      if (resp.ok) {
        const body: any = await resp.json();
        expect(body.ok).not.toBe(true);
      }
    } catch (err) {
      // Socket reset / connection closed — server defended itself.
      socketClosed = true;
      expect(err).toBeDefined();
    }
    expect(socketClosed || (responseStatus !== null && responseStatus !== 200)).toBe(true);
  });

  it('rejects non-POST verbs on /login and /logout', { timeout: 30000 }, async () => {
    bed = await setupBed({ masterPassword: 'correct-horse-battery-staple' });
    await bed.holder.initialize();

    const getLogin = await fetch(`${bed.origin}${TERMLNK_WEB_AUTH_PATH_PREFIX}/login`);
    expect(getLogin.status).toBe(405);
    const getLogout = await fetch(`${bed.origin}${TERMLNK_WEB_AUTH_PATH_PREFIX}/logout`);
    expect(getLogout.status).toBe(405);
  });
});

function extractSessionCookie(setCookieHeader: string): string {
  const match = new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`).exec(setCookieHeader);
  return match ? match[1]! : '';
}
