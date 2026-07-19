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

import type { IWebRendererConfig } from '../../../controllers/config.schema';
import { ConfigService, IConfigService, Injector } from '@termlnk/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WEB_RENDERER_PLUGIN_CONFIG_KEY } from '../../../controllers/config.schema';
import { WebTerminalOutputTransportService } from '../terminal-output-transport.service';

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly instances: FakeWebSocket[] = [];

  readonly close = vi.fn();
  readonly send = vi.fn();
  binaryType: BinaryType = 'blob';
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;
  readyState = FakeWebSocket.OPEN;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }
}

describe('WebTerminalOutputTransportService', () => {
  let injector: Injector;
  let originalWebSocket: typeof WebSocket;
  let service: WebTerminalOutputTransportService;

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    FakeWebSocket.instances.length = 0;
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;

    injector = new Injector();
    injector.add([IConfigService, { useClass: ConfigService }]);
    const configService = injector.get(IConfigService);
    const config: IWebRendererConfig = { origin: 'http://127.0.0.1:3000' };
    configService.setConfig(WEB_RENDERER_PLUGIN_CONFIG_KEY, config);
    service = new WebTerminalOutputTransportService(configService);
  });

  afterEach(() => {
    service.dispose();
    injector.dispose();
    globalThis.WebSocket = originalWebSocket;
  });

  it('reports malformed server text frames through the Observable error channel', () => {
    const error = vi.fn();
    service.data$('pty', 'session-1').subscribe({ error });
    const socket = FakeWebSocket.instances[0]!;

    socket.onmessage?.({ data: '{invalid-json' } as MessageEvent);

    expect(error).toHaveBeenCalledOnce();
    expect(error.mock.calls[0]![0]).toBeInstanceOf(SyntaxError);
    expect(socket.close).toHaveBeenCalledWith(1000);
  });
});
