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

import type { ITerminalOutputSink, ITerminalOutputStreamHandle, ITerminalOutputStreamService } from '@termlnk/rpc-server';
import type { TerminalOutputSourceType } from '@termlnk/terminal';
import type { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { decodeTerminalOutputFrame } from '@termlnk/terminal';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { createTerminalOutputWSHandler } from '../terminal-output/terminal-output-ws-handler';

class RecordingTerminalOutputStreamService implements ITerminalOutputStreamService {
  readonly acknowledge = vi.fn();
  readonly disposeStream = vi.fn();
  sink: ITerminalOutputSink | null = null;
  source: TerminalOutputSourceType | null = null;
  sessionId: string | null = null;

  open(source: TerminalOutputSourceType, sessionId: string, sink: ITerminalOutputSink): ITerminalOutputStreamHandle {
    this.source = source;
    this.sessionId = sessionId;
    this.sink = sink;
    return {
      acknowledge: this.acknowledge,
      dispose: this.disposeStream,
    };
  }

  dispose(): void {}
}

describe('terminal output WebSocket handler', () => {
  const cleanupTasks: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(cleanupTasks.splice(0).map((task) => task()));
  });

  it('streams binary frames and forwards parser acknowledgements', async () => {
    const streamService = new RecordingTerminalOutputStreamService();
    const handler = createTerminalOutputWSHandler(streamService);
    const server = createServer();
    server.on('upgrade', (req, socket, head) => handler.handleUpgrade(req, socket, head));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    cleanupTasks.push(async () => {
      await handler.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    const address = server.address() as AddressInfo;
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/terminal-output`);
    await once(socket, 'open');
    socket.send(JSON.stringify({ requestId: 'request-1', source: 'pty', sessionId: 'session-1' }));

    await waitFor(() => streamService.sink !== null);
    expect(streamService.source).toBe('pty');
    expect(streamService.sessionId).toBe('session-1');

    const messagePromise = once(socket, 'message');
    streamService.sink!.send({ sequence: 7, data: new Uint8Array([0x41, 0x42, 0x43]) });
    const [rawData, isBinary] = await messagePromise;
    const bytes = new Uint8Array(rawData);
    const frame = decodeTerminalOutputFrame(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

    expect(isBinary).toBe(true);
    expect(frame.sequence).toBe(7);
    expect([...frame.data]).toEqual([0x41, 0x42, 0x43]);

    socket.send(JSON.stringify({ type: 'ack', sequence: 7 }));
    await waitFor(() => streamService.acknowledge.mock.calls.length === 1);
    expect(streamService.acknowledge).toHaveBeenCalledWith(7);

    socket.close(1000);
    await once(socket, 'close');
    await waitFor(() => streamService.disposeStream.mock.calls.length === 1);
    expect(streamService.disposeStream).toHaveBeenCalledTimes(1);
  });
});

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 1));
  }
  throw new Error('Timed out waiting for condition');
}
