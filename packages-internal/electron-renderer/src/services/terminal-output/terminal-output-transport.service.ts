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

import type { Nullable } from '@termlnk/core';
import type { ITerminalOutputChunk, ITerminalOutputOpenRequest, ITerminalOutputTransportService, TerminalOutputSourceType } from '@termlnk/terminal';
import type { Observable } from 'rxjs';
import { Disposable } from '@termlnk/core';
import { parseTerminalOutputServerMessage, TERMINAL_OUTPUT_ELECTRON_PORT_CHANNEL, TerminalOutputAckBuffer } from '@termlnk/terminal';
import { Observable as RxObservable } from 'rxjs';

interface ITerminalOutputElectronBridge {
  open(request: ITerminalOutputOpenRequest): void;
  cancel(requestId: string): void;
}

interface ITerminalOutputPortResponse {
  readonly type: typeof TERMINAL_OUTPUT_ELECTRON_PORT_CHANNEL;
  readonly requestId: string;
  readonly error?: string;
}

export class ElectronTerminalOutputTransportService extends Disposable implements ITerminalOutputTransportService {
  data$(source: TerminalOutputSourceType, sessionId: string): Observable<ITerminalOutputChunk> {
    this.ensureNotDisposed();
    return new RxObservable<ITerminalOutputChunk>((subscriber) => {
      const bridge = getTerminalOutputBridge();
      const requestId = crypto.randomUUID();
      let port: Nullable<MessagePort> = null;
      let ackBuffer: Nullable<TerminalOutputAckBuffer> = null;
      let isDisposed = false;

      const handleWindowMessage = (event: MessageEvent<unknown>): void => {
        if (event.source !== window || !isPortResponse(event.data, requestId)) {
          return;
        }
        if (event.data.error) {
          subscriber.error(new Error(event.data.error));
          return;
        }

        const nextPort = event.ports[0];
        if (!nextPort) {
          subscriber.error(new Error('Terminal output port was not transferred'));
          return;
        }
        if (isDisposed) {
          nextPort.close();
          return;
        }

        port = nextPort;
        ackBuffer = new TerminalOutputAckBuffer((sequence) => {
          port?.postMessage({ type: 'ack', sequence });
        });
        port.onmessage = (messageEvent) => {
          let message;
          try {
            message = parseTerminalOutputServerMessage(messageEvent.data);
          } catch (error) {
            subscriber.error(error instanceof Error ? error : new Error(String(error)));
            return;
          }
          if (message.type === 'data') {
            let isAcknowledged = false;
            subscriber.next({
              data: message.data,
              sequence: message.sequence,
              acknowledge: () => {
                if (!isAcknowledged) {
                  isAcknowledged = true;
                  ackBuffer?.acknowledge(message.sequence, message.data.byteLength);
                }
              },
            });
            return;
          }
          if (message.type === 'error') {
            subscriber.error(new Error(message.message));
            return;
          }
          subscriber.complete();
        };
        port.onmessageerror = () => subscriber.error(new Error('Terminal output port received an invalid message'));
        port.start();
      };

      window.addEventListener('message', handleWindowMessage);
      bridge.open({ requestId, source, sessionId });

      return () => {
        isDisposed = true;
        window.removeEventListener('message', handleWindowMessage);
        ackBuffer?.dispose();
        if (port) {
          port.close();
        } else {
          bridge.cancel(requestId);
        }
      };
    });
  }
}

function getTerminalOutputBridge(): ITerminalOutputElectronBridge {
  const bridge = (globalThis as typeof globalThis & { __TERMLNK_TERMINAL_OUTPUT__?: ITerminalOutputElectronBridge }).__TERMLNK_TERMINAL_OUTPUT__;
  if (!bridge) {
    throw new Error('Terminal output preload bridge is unavailable');
  }
  return bridge;
}

function isPortResponse(value: unknown, requestId: string): value is ITerminalOutputPortResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const response = value as Partial<ITerminalOutputPortResponse>;
  return response.type === TERMINAL_OUTPUT_ELECTRON_PORT_CHANNEL
    && response.requestId === requestId
    && (response.error === undefined || typeof response.error === 'string');
}
