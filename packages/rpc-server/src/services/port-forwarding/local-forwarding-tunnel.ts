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
import { createServer } from 'node:net';
import { BasePortForwardingTunnel } from './port-forwarding-tunnel';

export class LocalForwardingTunnel extends BasePortForwardingTunnel {
  private _server: Nullable<Server> = null;
  private _activeSockets = new Set<Socket>();

  constructor(deps: IPortForwardingTunnelDeps) {
    super(deps);
  }

  protected async _attachToSocket(socket: ISSHSocket): Promise<void> {
    const dstAddr = this._rule.destinationAddress;
    const dstPort = this._rule.destinationPort;
    if (!dstAddr || !dstPort) {
      throw new Error(`Local forwarding rule ${this._rule.id} requires destinationAddress and destinationPort`);
    }
    const bindAddr = this._rule.bindAddress;
    const bindPort = this._rule.bindPort;

    const server = createServer((local) => {
      this._activeSockets.add(local);
      local.on('error', () => {
        this._activeSockets.delete(local);
        local.destroy();
      });
      local.on('close', () => {
        this._activeSockets.delete(local);
        this._decActive();
      });

      socket.forwardOut(bindAddr, bindPort, dstAddr, dstPort)
        .then((upstream) => {
          if (local.destroyed) {
            upstream.destroy();
            return;
          }
          upstream.on('error', () => {
            local.destroy();
            upstream.destroy();
          });
          this._incActive();
          if (this._meter) {
            this._meter.attach(local, upstream);
          } else {
            local.pipe(upstream).pipe(local);
          }
        })
        .catch((err) => {
          this._logService.warn(`[LocalForwarding ${this._rule.id}] forwardOut failed`, err);
          local.destroy();
        });
    });

    await new Promise<void>((resolve, reject) => {
      const onListenError = (err: Error) => {
        server.removeListener('listening', onListening);
        reject(err);
      };
      const onListening = () => {
        server.removeListener('error', onListenError);
        const addr = server.address();
        this._effectiveBindPort = typeof addr === 'object' && addr ? addr.port : bindPort;
        resolve();
      };
      server.once('error', onListenError);
      server.once('listening', onListening);
      server.listen(bindPort, bindAddr);
    });

    server.on('error', (err) => {
      this._logService.warn(`[LocalForwarding ${this._rule.id}] server error`, err);
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
}
