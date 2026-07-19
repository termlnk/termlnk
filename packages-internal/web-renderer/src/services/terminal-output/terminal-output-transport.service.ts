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

import type { ITerminalOutputChunk, ITerminalOutputTransportService, TerminalOutputSourceType } from '@termlnk/terminal';
import type { Observable } from 'rxjs';
import type { IWebRendererConfig } from '../../controllers/config.schema';
import { Disposable, IConfigService } from '@termlnk/core';
import { decodeTerminalOutputFrame, parseTerminalOutputServerMessage, TERMINAL_OUTPUT_WEB_SOCKET_PATH, TerminalOutputAckBuffer } from '@termlnk/terminal';
import { Observable as RxObservable } from 'rxjs';
import { WEB_RENDERER_PLUGIN_CONFIG_KEY } from '../../controllers/config.schema';

export class WebTerminalOutputTransportService extends Disposable implements ITerminalOutputTransportService {
  constructor(
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();
  }

  data$(source: TerminalOutputSourceType, sessionId: string): Observable<ITerminalOutputChunk> {
    this.ensureNotDisposed();
    return new RxObservable<ITerminalOutputChunk>((subscriber) => {
      const socket = new WebSocket(this._resolveUrl());
      const ackBuffer = new TerminalOutputAckBuffer((sequence) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ack', sequence }));
        }
      });
      let isSettled = false;

      socket.binaryType = 'arraybuffer';
      socket.onopen = () => {
        try {
          socket.send(JSON.stringify({
            requestId: crypto.randomUUID(),
            source,
            sessionId,
          }));
        } catch (error) {
          settleWithError(error);
        }
      };
      socket.onmessage = (event) => {
        if (typeof event.data === 'string') {
          let message;
          try {
            message = parseTerminalOutputServerMessage(JSON.parse(event.data));
          } catch (error) {
            settleWithError(error);
            return;
          }
          if (message.type === 'error') {
            settleWithError(new Error(message.message));
          } else {
            isSettled = true;
            subscriber.complete();
          }
          return;
        }

        try {
          if (!(event.data instanceof ArrayBuffer)) {
            throw new TypeError('Terminal output WebSocket received unsupported binary data');
          }
          const frame = decodeTerminalOutputFrame(event.data);
          let isAcknowledged = false;
          subscriber.next({
            data: frame.data,
            sequence: frame.sequence,
            acknowledge: () => {
              if (!isAcknowledged) {
                isAcknowledged = true;
                ackBuffer.acknowledge(frame.sequence, frame.data.byteLength);
              }
            },
          });
        } catch (error) {
          settleWithError(error);
        }
      };
      socket.onerror = () => {
        settleWithError(new Error('Terminal output WebSocket failed'));
      };
      socket.onclose = (event) => {
        if (!isSettled) {
          isSettled = true;
          if (event.code === 1000) {
            subscriber.complete();
          } else {
            subscriber.error(new Error(`Terminal output WebSocket closed with code ${event.code}`));
          }
        }
      };

      return () => {
        isSettled = true;
        ackBuffer.dispose();
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close(1000);
        }
      };

      function settleWithError(error: unknown): void {
        if (isSettled) {
          return;
        }
        isSettled = true;
        subscriber.error(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private _resolveUrl(): string {
    const config = this._configService.getConfig<IWebRendererConfig>(WEB_RENDERER_PLUGIN_CONFIG_KEY);
    const origin = config?.origin ?? '';
    if (origin) {
      return `${origin.replace(/^http/, 'ws')}${TERMINAL_OUTPUT_WEB_SOCKET_PATH}`;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${TERMINAL_OUTPUT_WEB_SOCKET_PATH}`;
  }
}
