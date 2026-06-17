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

import type { IWebRendererConfig } from '../controllers/config.schema';
import { ConfigService, DesktopLogService, IConfigService, ILogService, Injector, UpdateStatus } from '@termlnk/core';
import { DefaultFetchProvider, FetchHTTPImplementation, HTTPService, IFetchProvider, IHTTPImplementation } from '@termlnk/network';
import { firstValueFrom, skip, take } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WEB_RENDERER_PLUGIN_CONFIG_KEY } from '../controllers/config.schema';
import { WebRPCClientService } from '../services/rpc/web-rpc-client.service';
import { WebUpdaterService } from '../services/updater/web-updater.service';
import { NoopWindowManagerService } from '../services/window-manager/noop-window-manager.service';

function bedWithConfig(cfg: IWebRendererConfig): {
  configService: IConfigService;
  logService: ILogService;
  httpService: HTTPService;
  injector: Injector;
} {
  const injector = new Injector();
  injector.add([IConfigService, { useClass: ConfigService }]);
  injector.add([ILogService, { useClass: DesktopLogService }]);
  injector.add([IFetchProvider, { useClass: DefaultFetchProvider }]);
  injector.add([IHTTPImplementation, { useClass: FetchHTTPImplementation }]);
  injector.add([HTTPService]);
  const configService = injector.get(IConfigService);
  const logService = injector.get(ILogService);
  const httpService = injector.get(HTTPService);
  configService.setConfig(WEB_RENDERER_PLUGIN_CONFIG_KEY, cfg);
  return { configService, logService, httpService, injector };
}

describe('webRPCClientService', () => {
  it('exposes a tRPC client without throwing on construction', () => {
    const { configService } = bedWithConfig({ origin: '' });
    const svc = new WebRPCClientService(configService);
    const client = svc.getClient();
    expect(client).toBeDefined();
    // tRPC v11 returns a Proxy/function that supports `client.foo.bar.query()`
    // chains. Either 'function' or 'object' is acceptable — we just need it
    // to be a callable surface, not undefined.
    expect(['function', 'object']).toContain(typeof client);
    svc.dispose();
  });

  it('honours the origin override when provided', () => {
    const { configService } = bedWithConfig({ origin: 'https://myhost.example.com' });
    const svc = new WebRPCClientService(configService);
    expect(svc.getClient()).toBeDefined();
    svc.dispose();
  });
});

describe('webUpdaterService', () => {
  // Pin initialDelayMs to a value far beyond test runtime so the auto-check
  // timer never fires during these unit tests. Tests drive checkForUpdates()
  // directly to keep assertions deterministic.
  const baseConfig: IWebRendererConfig = {
    origin: '',
    updater: {
      repo: 'termlnk/termlnk',
      githubApiBase: 'https://api.example',
      initialDelayMs: 60_000_000,
      checkIntervalMs: 60_000_000,
      currentVersion: '0.0.1',
    },
  };

  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('starts in IDLE and reports the configured currentVersion', async () => {
    const { configService, logService, httpService } = bedWithConfig(baseConfig);
    const svc = new WebUpdaterService(configService, logService, httpService);
    expect(await svc.getStatus()).toBe(UpdateStatus.IDLE);
    expect(await svc.getCurrentVersion()).toBe('0.0.1');
    svc.dispose();
  });

  it('flips status to AVAILABLE when GitHub returns a newer release', async () => {
    globalThis.fetch = vi.fn(async () => new Response(
      JSON.stringify({
        tag_name: 'v0.1.0',
        body: '## Changes\n- foo',
        published_at: '2026-05-10T00:00:00Z',
      }),
      { status: 200 }
    )) as unknown as typeof fetch;

    const { configService, logService, httpService } = bedWithConfig(baseConfig);
    const svc = new WebUpdaterService(configService, logService, httpService);
    const info = await svc.checkForUpdates();
    expect(info?.version).toBe('0.1.0');
    expect(await svc.getStatus()).toBe(UpdateStatus.AVAILABLE);
    const lastInfo = await firstValueFrom(svc.updateInfo$);
    expect(lastInfo?.version).toBe('0.1.0');
    svc.dispose();
  });

  it('reports NOT_AVAILABLE when GitHub release matches the current version', async () => {
    globalThis.fetch = vi.fn(async () => new Response(
      JSON.stringify({ tag_name: 'v0.0.1' }),
      { status: 200 }
    )) as unknown as typeof fetch;

    const { configService, logService, httpService } = bedWithConfig(baseConfig);
    const svc = new WebUpdaterService(configService, logService, httpService);
    expect(await svc.checkForUpdates()).toBeNull();
    expect(await svc.getStatus()).toBe(UpdateStatus.NOT_AVAILABLE);
    svc.dispose();
  });

  it('skips drafts and prereleases', async () => {
    globalThis.fetch = vi.fn(async () => new Response(
      JSON.stringify({ tag_name: 'v9.9.9', prerelease: true }),
      { status: 200 }
    )) as unknown as typeof fetch;

    const { configService, logService, httpService } = bedWithConfig(baseConfig);
    const svc = new WebUpdaterService(configService, logService, httpService);
    expect(await svc.checkForUpdates()).toBeNull();
    expect(await svc.getStatus()).toBe(UpdateStatus.NOT_AVAILABLE);
    svc.dispose();
  });

  it('flips status to ERROR when GitHub responds non-2xx', async () => {
    globalThis.fetch = vi.fn(async () => new Response('rate limited', { status: 403 })) as unknown as typeof fetch;

    const { configService, logService, httpService } = bedWithConfig(baseConfig);
    const svc = new WebUpdaterService(configService, logService, httpService);
    const errorPromise = firstValueFrom(svc.error$);
    await svc.checkForUpdates();
    expect(await svc.getStatus()).toBe(UpdateStatus.ERROR);
    const err = await errorPromise;
    expect(err.message).toContain('403');
    svc.dispose();
  });

  it('rejects download / install with NOT_SUPPORTED — web shells cannot self-update', async () => {
    const { configService, logService, httpService } = bedWithConfig(baseConfig);
    const svc = new WebUpdaterService(configService, logService, httpService);
    await expect(svc.downloadUpdate()).rejects.toThrow(/not supported/i);
    await expect(svc.quitAndInstall()).rejects.toThrow(/not supported/i);
    svc.dispose();
  });

  it('emits CHECKING before settling on a terminal status', async () => {
    let resolveFetch: (() => void) | undefined;
    const fetchGate = new Promise<void>((resolve) => {
      resolveFetch = resolve;
    });
    globalThis.fetch = vi.fn(async () => {
      await fetchGate;
      return new Response(JSON.stringify({ tag_name: 'v0.1.0' }), { status: 200 });
    }) as unknown as typeof fetch;

    const { configService, logService, httpService } = bedWithConfig(baseConfig);
    const svc = new WebUpdaterService(configService, logService, httpService);
    // Skip the IDLE replay so we capture the CHECKING transition.
    const checkingPromise = firstValueFrom(svc.status$.pipe(skip(1), take(1)));
    const checkPromise = svc.checkForUpdates();
    expect(await checkingPromise).toBe(UpdateStatus.CHECKING);
    resolveFetch!();
    await checkPromise;
    svc.dispose();
  });
});

describe('noopWindowManagerService', () => {
  it('reports a single virtual window with id 1', async () => {
    const svc = new NoopWindowManagerService();
    expect(await svc.getCurrentWindowId()).toBe(1);
    expect(await svc.hasWindow(1)).toBe(true);
    expect(await svc.hasWindow(2)).toBe(false);
  });

  it('mutators resolve without side effects', async () => {
    const svc = new NoopWindowManagerService();
    await expect(svc.minimizeWindow(1)).resolves.toBeUndefined();
    await expect(svc.maximizeWindow(1)).resolves.toBeUndefined();
    await expect(svc.toggleFullScreen(1)).resolves.toBeUndefined();
    await expect(svc.setOpacity(1, 0.5)).resolves.toBeUndefined();
    await expect(svc.setVibrancy(1, null)).resolves.toBeUndefined();
  });

  it('windowState$ emits the virtual window snapshot', async () => {
    const svc = new NoopWindowManagerService();
    const map = await firstValueFrom(svc.windowState$);
    const state = map.get(1);
    expect(state).toBeDefined();
    expect(state!.id).toBe(1);
    expect(state!.fullScreen).toBe(false);
    expect(state!.isMaximized).toBe(false);
  });
});
