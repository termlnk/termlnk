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

import type { ITerminalOutputStreamHandle, ITerminalOutputStreamService } from '@termlnk/rpc-server';
import type { Buffer } from 'node:buffer';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { encodeTerminalOutputFrame, isTerminalOutputAckMessage, isTerminalOutputOpenRequest } from '@termlnk/terminal';
import { WebSocket, WebSocketServer } from 'ws';

export interface ITerminalOutputWSHandlerHandle {
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void;
  close(): Promise<void>;
}

export function createTerminalOutputWSHandler(
  streamService: ITerminalOutputStreamService
): ITerminalOutputWSHandlerHandle {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (socket) => {
    let stream: ITerminalOutputStreamHandle | null = null;

    socket.on('message', (data, isBinary) => {
      if (isBinary) {
        socket.close(1003, 'Binary client messages are not supported');
        return;
      }

      let message: unknown;
      try {
        message = JSON.parse(data.toString());
      } catch {
        socket.close(1007, 'Invalid JSON');
        return;
      }

      if (!stream) {
        if (!isTerminalOutputOpenRequest(message)) {
          socket.close(1008, 'Expected terminal output open request');
          return;
        }
        try {
          stream = streamService.open(message.source, message.sessionId, {
            send: (frame) => {
              if (socket.readyState !== WebSocket.OPEN) {
                throw new Error('Terminal output WebSocket is not open');
              }
              socket.send(encodeTerminalOutputFrame(frame.sequence, frame.data), { binary: true });
            },
            complete: () => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'close' }));
                socket.close(1000);
              }
            },
            error: (error) => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'error', message: error.message }));
                socket.close(1011);
              }
            },
          });
        } catch (error) {
          socket.send(JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : String(error),
          }));
          socket.close(1008);
        }
        return;
      }

      if (isTerminalOutputAckMessage(message)) {
        stream.acknowledge(message.sequence);
        return;
      }
      socket.close(1008, 'Expected terminal output acknowledgement');
    });

    socket.on('close', () => {
      stream?.dispose();
      stream = null;
    });
  });

  return {
    handleUpgrade: (req, socket, head) => {
      wss.handleUpgrade(req, socket, head, (client) => {
        wss.emit('connection', client, req);
      });
    },
    close: async () => {
      for (const client of wss.clients) {
        client.terminate();
      }
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
}
