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

import type { ITerminalOutputChunk, ITerminalOutputOpenRequest } from '@termlnk/terminal';
import { TERMINAL_OUTPUT_ACK_INTERVAL_MS, TERMINAL_OUTPUT_ELECTRON_PORT_CHANNEL } from '@termlnk/terminal';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ElectronTerminalOutputTransportService } from '../terminal-output-transport.service';

interface ITerminalOutputElectronBridge {
  open(request: ITerminalOutputOpenRequest): void;
  cancel(requestId: string): void;
}

class FakeMessagePort {
  readonly close = vi.fn();
  readonly postMessage = vi.fn();
  readonly start = vi.fn();
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onmessageerror: (() => void) | null = null;
}

describe('ElectronTerminalOutputTransportService', () => {
  let bridge: ITerminalOutputElectronBridge;
  let originalBridge: ITerminalOutputElectronBridge | undefined;
  let service: ElectronTerminalOutputTransportService;

  beforeEach(() => {
    originalBridge = getGlobalBridge();
    bridge = {
      open: vi.fn(),
      cancel: vi.fn(),
    };
    setGlobalBridge(bridge);
    service = new ElectronTerminalOutputTransportService();
  });

  afterEach(() => {
    vi.useRealTimers();
    service.dispose();
    setGlobalBridge(originalBridge);
  });

  it('streams binary chunks and batches parser acknowledgements over the transferred port', () => {
    vi.useFakeTimers();
    const chunks: ITerminalOutputChunk[] = [];
    const subscription = service.data$('pty', 'session-1').subscribe((chunk) => chunks.push(chunk));
    const request = vi.mocked(bridge.open).mock.calls[0]![0];
    const port = new FakeMessagePort();

    dispatchPortResponse(request.requestId, port);
    port.onmessage?.({ data: { type: 'data', sequence: 7, data: new Uint8Array([0x41]) } } as MessageEvent);

    expect(chunks).toHaveLength(1);
    chunks[0]!.acknowledge();
    chunks[0]!.acknowledge();
    vi.advanceTimersByTime(TERMINAL_OUTPUT_ACK_INTERVAL_MS);

    expect(port.postMessage).toHaveBeenCalledOnce();
    expect(port.postMessage).toHaveBeenCalledWith({ type: 'ack', sequence: 7 });
    subscription.unsubscribe();
    expect(port.close).toHaveBeenCalledOnce();
  });

  it('reports invalid structured messages through the Observable error channel', () => {
    const error = vi.fn();
    service.data$('ssh', 'session-1').subscribe({ error });
    const request = vi.mocked(bridge.open).mock.calls[0]![0];
    const port = new FakeMessagePort();

    dispatchPortResponse(request.requestId, port);
    port.onmessage?.({ data: { type: 'data', sequence: 1, data: 'base64' } } as MessageEvent);

    expect(error).toHaveBeenCalledOnce();
    expect(port.close).toHaveBeenCalledOnce();
  });
});

function dispatchPortResponse(requestId: string, port: FakeMessagePort): void {
  const event = new MessageEvent('message', {
    data: { type: TERMINAL_OUTPUT_ELECTRON_PORT_CHANNEL, requestId },
    ports: [port as unknown as MessagePort],
  });
  Object.defineProperty(event, 'source', { value: window });
  window.dispatchEvent(event);
}

function getGlobalBridge(): ITerminalOutputElectronBridge | undefined {
  return (globalThis as typeof globalThis & {
    __TERMLNK_TERMINAL_OUTPUT__?: ITerminalOutputElectronBridge;
  }).__TERMLNK_TERMINAL_OUTPUT__;
}

function setGlobalBridge(bridge: ITerminalOutputElectronBridge | undefined): void {
  (globalThis as typeof globalThis & {
    __TERMLNK_TERMINAL_OUTPUT__?: ITerminalOutputElectronBridge;
  }).__TERMLNK_TERMINAL_OUTPUT__ = bridge;
}
