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
import { createIdentifier, Disposable, DisposableCollection, ILogService, Optional, toDisposable } from '@termlnk/core';
import { Observable } from 'rxjs';
import { share } from 'rxjs/operators';

export type SocketBodyType = string | ArrayBuffer | Blob | ArrayBufferView<ArrayBuffer>;

/**
 * This service is responsible for establishing bidi-directional connection to a remote server.
 */
export interface ISocketService {
  createSocket(url: string): Nullable<ISocket>;
}
export const ISocketService = createIdentifier<ISocketService>('network.socket-service');

/**
 * An interface that represents a socket connection.
 */
export interface ISocket {
  URL: string;

  close(code?: number, reason?: string): void;

  /**
   * Send a message to the remote server.
   */
  send(data: SocketBodyType): void;

  close$: Observable<Event>;
  error$: Observable<Event>;
  message$: Observable<MessageEvent>;
  open$: Observable<Event>;
}

/**
 * This service create a WebSocket connection to a remote server.
 */
export class WebSocketService extends Disposable implements ISocketService {
  constructor(
    @Optional(ILogService) private readonly _logService?: ILogService
  ) {
    super();
  }

  createSocket(URL: string): Nullable<ISocket> {
    try {
      const connection = new WebSocket(URL);

      const disposables = new DisposableCollection();
      const webSocket: ISocket = {
        URL,
        close: (code?: number, reason?: string) => {
          connection.close(code, reason);
          disposables.dispose();
        },
        send: (data: SocketBodyType) => {
          connection.send(data);
        },
        open$: new Observable<Event>((subscriber) => {
          const callback = (event: Event) => subscriber.next(event);
          connection.addEventListener('open', callback);
          disposables.add(toDisposable(() => connection.removeEventListener('open', callback)));
        }).pipe(share()),
        close$: new Observable<Event>((subscriber) => {
          const callback = (event: Event) => subscriber.next(event);
          connection.addEventListener('close', callback);
          disposables.add(toDisposable(() => connection.removeEventListener('close', callback)));
        }).pipe(share()),
        error$: new Observable<Event>((subscriber) => {
          const callback = (event: Event) => subscriber.next(event);
          connection.addEventListener('error', callback);
          disposables.add(toDisposable(() => connection.removeEventListener('error', callback)));
        }).pipe(share()),
        message$: new Observable<MessageEvent>((subscriber) => {
          const callback = (event: MessageEvent) => subscriber.next(event);
          connection.addEventListener('message', callback);
          disposables.add(toDisposable(() => connection.removeEventListener('message', callback)));
        }).pipe(share()),
      };

      return webSocket;
    } catch (e) {
      this._logService?.error(e);
      return null;
    }
  }
}
