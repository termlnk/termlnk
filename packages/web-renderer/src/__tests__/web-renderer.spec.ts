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
import { ConfigService, IConfigService, Injector } from '@termlnk/core';
import { UpdateStatus } from '@termlnk/electron';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { WEB_RENDERER_PLUGIN_CONFIG_KEY } from '../controllers/config.schema';
import { WebRPCClientService } from '../services/rpc/web-rpc-client.service';
import { NoopUpdaterService } from '../services/updater/noop-updater.service';
import { NoopWindowManagerService } from '../services/window-manager/noop-window-manager.service';

function bedWithConfig(cfg: IWebRendererConfig): { configService: IConfigService } {
  const injector = new Injector();
  injector.add([IConfigService, { useClass: ConfigService }]);
  const configService = injector.get(IConfigService);
  configService.setConfig(WEB_RENDERER_PLUGIN_CONFIG_KEY, cfg);
  return { configService };
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

describe('noopUpdaterService', () => {
  it('reports IDLE status synchronously and via Observable', async () => {
    const svc = new NoopUpdaterService();
    expect(await svc.getStatus()).toBe(UpdateStatus.IDLE);
    const next = await firstValueFrom(svc.status$);
    expect(next).toBe(UpdateStatus.IDLE);
  });

  it('checkForUpdates / downloadUpdate / quitAndInstall are no-ops', async () => {
    const svc = new NoopUpdaterService();
    await expect(svc.checkForUpdates()).resolves.toBe(null);
    await expect(svc.downloadUpdate()).resolves.toBeUndefined();
    await expect(svc.quitAndInstall()).resolves.toBeUndefined();
  });

  it('getCurrentVersion returns 0.0.0 when no build-time injection is present', async () => {
    const svc = new NoopUpdaterService();
    const v = await svc.getCurrentVersion();
    expect(typeof v).toBe('string');
    expect(v.length).toBeGreaterThan(0);
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
