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
import type { Server, Socket } from 'node:net';
import type { ISSHSocket } from '../ssh/ssh-socket';
import type { IPortForwardingTunnelDeps } from './port-forwarding-tunnel';
import { Buffer } from 'node:buffer';
import { createServer } from 'node:net';
import { BasePortForwardingTunnel } from './port-forwarding-tunnel';

// SOCKS5 protocol (RFC 1928) wire constants.
const SOCKS_VERSION = 0x05;
const AUTH_NONE = 0x00;
const AUTH_NO_ACCEPTABLE = 0xFF;
const CMD_CONNECT = 0x01;
const ATYP_IPV4 = 0x01;
const ATYP_DOMAIN = 0x03;
const ATYP_IPV6 = 0x04;
const REPLY_SUCCEEDED = 0x00;
const REPLY_GENERAL_FAILURE = 0x01;
const REPLY_HOST_UNREACHABLE = 0x04;
const REPLY_CMD_NOT_SUPPORTED = 0x07;
const REPLY_ATYP_NOT_SUPPORTED = 0x08;

export class DynamicForwardingTunnel extends BasePortForwardingTunnel {
  private _server: Nullable<Server> = null;
  private _activeSockets = new Set<Socket>();

  constructor(deps: IPortForwardingTunnelDeps) {
    super(deps);
  }

  protected async _attachToSocket(socket: ISSHSocket): Promise<void> {
    const bindAddr = this._rule.bindAddress;
    const bindPort = this._rule.bindPort;

    const server = createServer((client) => {
      this._activeSockets.add(client);
      client.on('error', () => {
        this._activeSockets.delete(client);
        client.destroy();
      });
      client.on('close', () => {
        this._activeSockets.delete(client);
      });
      void this._handleClient(client, socket);
    });

    await new Promise<void>((resolve, reject) => {
      const onErr = (err: Error) => {
        server.removeListener('listening', onOk);
        reject(err);
      };
      const onOk = () => {
        server.removeListener('error', onErr);
        const addr = server.address();
        this._effectiveBindPort = typeof addr === 'object' && addr ? addr.port : bindPort;
        resolve();
      };
      server.once('error', onErr);
      server.once('listening', onOk);
      server.listen(bindPort, bindAddr);
    });

    server.on('error', (err) => {
      this._logService.warn(`[DynamicForwarding ${this._rule.id}] server error`, err);
    });
    this._server = server;
  }

  protected async _detachFromSocket(_socket: ISSHSocket): Promise<void> {
    const server = this._server;
    this._server = null;
    if (!server) {
      return;
    }
    for (const sock of this._activeSockets) {
      sock.destroy();
    }
    this._activeSockets.clear();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }

  private async _handleClient(client: Socket, socket: ISSHSocket): Promise<void> {
    try {
      await this._handshake(client);
      const request = await this._readConnectRequest(client);
      if (!request) {
        return;
      }
      const upstream = await socket.forwardOut(
        client.remoteAddress ?? '127.0.0.1',
        client.remotePort ?? 0,
        request.host,
        request.port
      ).catch((err) => {
        this._logService.warn(`[DynamicForwarding ${this._rule.id}] forwardOut failed`, err);
        return null;
      });
      if (!upstream) {
        client.end(buildReply(REPLY_HOST_UNREACHABLE));
        return;
      }
      if (client.destroyed) {
        upstream.destroy();
        return;
      }
      // SOCKS5 reply: success with the bound address being 0.0.0.0:0 — the
      // standard convention for tunnels where the proxy doesn't expose a
      // meaningful endpoint to the client.
      client.write(buildReply(REPLY_SUCCEEDED));
      upstream.on('error', () => {
        client.destroy();
        upstream.destroy();
      });
      this._incActive();
      client.on('close', () => {
        this._decActive();
      });
      if (this._meter) {
        this._meter.attach(client, upstream);
      } else {
        client.pipe(upstream).pipe(client);
      }
    } catch (err) {
      this._logService.warn(`[DynamicForwarding ${this._rule.id}] client error`, err);
      try {
        client.end(buildReply(REPLY_GENERAL_FAILURE));
      } catch { /* ignore */ }
    }
  }

  private async _handshake(client: Socket): Promise<void> {
    const greet = await readExactly(client, 2);
    if (greet[0] !== SOCKS_VERSION) {
      throw new Error(`Unsupported SOCKS version: ${greet[0]}`);
    }
    const nMethods = greet[1];
    const methods = await readExactly(client, nMethods);
    if (!methods.includes(AUTH_NONE)) {
      client.end(Buffer.from([SOCKS_VERSION, AUTH_NO_ACCEPTABLE]));
      throw new Error('Client offered no acceptable auth methods');
    }
    client.write(Buffer.from([SOCKS_VERSION, AUTH_NONE]));
  }

  private async _readConnectRequest(client: Socket): Promise<{ host: string; port: number } | null> {
    const header = await readExactly(client, 4);
    if (header[0] !== SOCKS_VERSION) {
      throw new Error(`Unsupported SOCKS version in request: ${header[0]}`);
    }
    if (header[1] !== CMD_CONNECT) {
      client.end(buildReply(REPLY_CMD_NOT_SUPPORTED));
      return null;
    }
    const atyp = header[3];
    let host: string;
    if (atyp === ATYP_IPV4) {
      const bytes = await readExactly(client, 4);
      host = `${bytes[0]}.${bytes[1]}.${bytes[2]}.${bytes[3]}`;
    } else if (atyp === ATYP_DOMAIN) {
      const lenBuf = await readExactly(client, 1);
      const bytes = await readExactly(client, lenBuf[0]);
      host = bytes.toString('utf8');
    } else if (atyp === ATYP_IPV6) {
      const bytes = await readExactly(client, 16);
      const parts: string[] = [];
      for (let i = 0; i < 16; i += 2) {
        parts.push(bytes.readUInt16BE(i).toString(16));
      }
      host = parts.join(':');
    } else {
      client.end(buildReply(REPLY_ATYP_NOT_SUPPORTED));
      return null;
    }
    const portBuf = await readExactly(client, 2);
    const port = portBuf.readUInt16BE(0);
    return { host, port };
  }
}

function buildReply(code: number): Buffer {
  // REP byte + RSV + ATYP=IPv4 + BND.ADDR=0.0.0.0 + BND.PORT=0
  return Buffer.from([SOCKS_VERSION, code, 0x00, ATYP_IPV4, 0, 0, 0, 0, 0, 0]);
}

// Pull-mode reader: uses 'readable' + socket.read(n) instead of 'data'
// events.  The 'data'-based pattern has a fatal flaw: adding a listener
// sets state.flowing=true, and cleanup() removes the listener WITHOUT
// resetting flowing.  A subsequent on('data') therefore skips resume()
// (already flowing) so flow() never drains the buffer — any bytes
// returned by unshift() are stuck forever and the next read hangs.
function readExactly(socket: Socket, n: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const tryRead = (): void => {
      if (socket.readableLength >= n) {
        const chunk = socket.read(n) as Buffer | null;
        if (chunk !== null) {
          cleanup();
          resolve(chunk);
        }
      }
    };
    const onReadable = (): void => tryRead();
    const onErr = (err: Error): void => {
      cleanup();
      reject(err);
    };
    const onEnd = (): void => {
      cleanup();
      reject(new Error('SOCKS5 client closed before sending required bytes'));
    };
    const cleanup = (): void => {
      socket.removeListener('readable', onReadable);
      socket.removeListener('error', onErr);
      socket.removeListener('end', onEnd);
    };
    socket.on('readable', onReadable);
    socket.on('error', onErr);
    socket.on('end', onEnd);
    tryRead();
  });
}
