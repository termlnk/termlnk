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

import type { ITerminalOutputStreamHandle } from '@termlnk/rpc-server';
import type { ITerminalOutputOpenRequest } from '@termlnk/terminal';
import type { IpcMainEvent, MessagePortMain } from 'electron';
import { Disposable } from '@termlnk/core';
import { ITerminalOutputStreamService } from '@termlnk/rpc-server';
import { isTerminalOutputAckMessage, isTerminalOutputOpenRequest, TERMINAL_OUTPUT_ELECTRON_CANCEL_CHANNEL, TERMINAL_OUTPUT_ELECTRON_OPEN_CHANNEL, TERMINAL_OUTPUT_ELECTRON_PORT_CHANNEL } from '@termlnk/terminal';
import { ipcMain, MessageChannelMain } from 'electron';

interface ITerminalOutputConnection {
  readonly key: string;
  readonly requestId: string;
  readonly port: MessagePortMain;
  stream: ITerminalOutputStreamHandle | null;
  isClosed: boolean;
}

export class TerminalOutputController extends Disposable {
  private readonly _connections = new Map<string, ITerminalOutputConnection>();

  constructor(
    @ITerminalOutputStreamService private readonly _terminalOutputStreamService: ITerminalOutputStreamService
  ) {
    super();
    ipcMain.on(TERMINAL_OUTPUT_ELECTRON_OPEN_CHANNEL, this._handleOpen);
    ipcMain.on(TERMINAL_OUTPUT_ELECTRON_CANCEL_CHANNEL, this._handleCancel);
  }

  override dispose(): void {
    super.dispose();
    ipcMain.removeListener(TERMINAL_OUTPUT_ELECTRON_OPEN_CHANNEL, this._handleOpen);
    ipcMain.removeListener(TERMINAL_OUTPUT_ELECTRON_CANCEL_CHANNEL, this._handleCancel);
    for (const connection of this._connections.values()) {
      this._closeConnection(connection);
    }
    this._connections.clear();
  }

  private readonly _handleOpen = (event: IpcMainEvent, rawRequest: unknown): void => {
    if (!isTerminalOutputOpenRequest(rawRequest)) {
      return;
    }

    const request = rawRequest;
    const key = this._connectionKey(event, request.requestId);
    this._closeConnection(this._connections.get(key));

    const { port1, port2 } = new MessageChannelMain();
    const connection: ITerminalOutputConnection = {
      key,
      requestId: request.requestId,
      port: port2,
      stream: null,
      isClosed: false,
    };
    this._connections.set(key, connection);

    port2.on('message', (messageEvent) => {
      const message = messageEvent.data;
      if (isTerminalOutputAckMessage(message)) {
        connection.stream?.acknowledge(message.sequence);
      }
    });
    port2.on('close', () => this._closeConnection(connection));
    port2.start();

    void this._openStream(event, request, connection, port1);
  };

  private async _openStream(
    event: IpcMainEvent,
    request: ITerminalOutputOpenRequest,
    connection: ITerminalOutputConnection,
    port1: MessagePortMain
  ): Promise<void> {
    try {
      const stream = await this._terminalOutputStreamService.open(request.source, request.sessionId, {
        send: (frame) => connection.port.postMessage({ type: 'data', sequence: frame.sequence, data: frame.data }),
        complete: () => connection.port.postMessage({ type: 'close' }),
        error: (error) => connection.port.postMessage({ type: 'error', message: error.message }),
      });
      // The renderer may have cancelled while the stream was waiting for the
      // session to appear; drop the handle instead of leaking it.
      if (connection.isClosed) {
        stream.dispose();
        return;
      }
      connection.stream = stream;
      const senderFrame = event.senderFrame;
      if (!senderFrame) {
        throw new Error('Terminal output request has no sender frame');
      }
      senderFrame.postMessage(
        TERMINAL_OUTPUT_ELECTRON_PORT_CHANNEL,
        { requestId: request.requestId },
        [port1]
      );
    } catch (error) {
      this._closeConnection(connection);
      try {
        event.reply(TERMINAL_OUTPUT_ELECTRON_PORT_CHANNEL, {
          requestId: request.requestId,
          error: error instanceof Error ? error.message : String(error),
        });
      } catch {
        // The renderer frame may already be gone; nothing left to notify.
      }
    }
  }

  private readonly _handleCancel = (event: IpcMainEvent, requestId: unknown): void => {
    if (typeof requestId !== 'string') {
      return;
    }
    this._closeConnection(this._connections.get(this._connectionKey(event, requestId)));
  };

  private _connectionKey(event: IpcMainEvent, requestId: string): string {
    return `${event.sender.id}:${requestId}`;
  }

  private _closeConnection(connection: ITerminalOutputConnection | undefined): void {
    if (!connection || connection.isClosed) {
      return;
    }
    connection.isClosed = true;
    connection.stream?.dispose();
    connection.stream = null;
    connection.port.close();
    this._connections.delete(connection.key);
  }
}
