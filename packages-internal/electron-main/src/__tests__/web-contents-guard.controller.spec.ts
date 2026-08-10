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
import type { HandlerDetails } from 'electron';
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';

const openExternal = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);

vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  const app = new EventEmitter();
  return { app, shell: { openExternal } };
});

const { app } = await import('electron');
const { WebContentsGuardController } = await import('../controllers/web-contents-guard.controller');

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

class FakeWebContents extends EventEmitter {
  setWindowOpenHandler = vi.fn();
}

function createBed() {
  const controller = new WebContentsGuardController(new NoopLogService());
  const contents = new FakeWebContents();
  app.emit('web-contents-created', {}, contents);
  return { controller, contents };
}

function getWindowOpenHandler(contents: FakeWebContents): (details: Partial<HandlerDetails>) => { action: string } {
  return contents.setWindowOpenHandler.mock.calls[0][0];
}

describe('WebContentsGuardController', () => {
  let controller: { dispose: () => void } | undefined;

  afterEach(() => {
    controller?.dispose();
    controller = undefined;
    (app as EventEmitter).removeAllListeners();
    openExternal.mockClear();
  });

  it('installs a window-open handler on every created webContents', () => {
    const bed = createBed();
    controller = bed.controller;
    expect(bed.contents.setWindowOpenHandler).toHaveBeenCalledOnce();
  });

  it('denies window.open and routes http(s) URLs to the system browser', () => {
    const bed = createBed();
    controller = bed.controller;

    const result = getWindowOpenHandler(bed.contents)({ url: 'https://github.com/animir/node-rate-limiter-flexible' });

    expect(result).toEqual({ action: 'deny' });
    expect(openExternal).toHaveBeenCalledWith('https://github.com/animir/node-rate-limiter-flexible');
  });

  it('denies window.open without opening unsafe schemes', () => {
    const bed = createBed();
    controller = bed.controller;
    const handler = getWindowOpenHandler(bed.contents);

    for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'termlnk://auth', 'not a url']) {
      expect(handler({ url })).toEqual({ action: 'deny' });
    }
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('prevents main-frame navigation and routes safe URLs to the system browser', () => {
    const bed = createBed();
    controller = bed.controller;

    const preventDefault = vi.fn();
    bed.contents.emit('will-navigate', { url: 'https://example.com', preventDefault });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(openExternal).toHaveBeenCalledWith('https://example.com');
  });

  it('prevents main-frame navigation to unsafe URLs without opening them', () => {
    const bed = createBed();
    controller = bed.controller;

    const preventDefault = vi.fn();
    bed.contents.emit('will-navigate', { url: 'file:///etc/passwd', preventDefault });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('stops guarding webContents after dispose', () => {
    const bed = createBed();
    controller = bed.controller;

    expect((app as EventEmitter).listenerCount('web-contents-created')).toBe(1);
    controller.dispose();
    controller = undefined;
    expect((app as EventEmitter).listenerCount('web-contents-created')).toBe(0);
  });
});
