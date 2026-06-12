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
import type { Socket } from 'node:net';
import type { Subscription } from 'rxjs';
import type { ISSHSocket } from '../ssh/ssh-socket';
import type { IPortForwardingTunnelDeps } from './port-forwarding-tunnel';
import { connect as netConnect } from 'node:net';
import { BasePortForwardingTunnel } from './port-forwarding-tunnel';

// -R: ask the SSH server to listen on `bindAddress:bindPort`; every TCP
// connection it accepts is delivered to us via `tcpConnection$`. We filter on
// destPort to discriminate between multiple Remote rules sharing one socket,
// then connect locally to `destinationAddress:destinationPort` and pipe.
export class RemoteForwardingTunnel extends BasePortForwardingTunnel {
  private _tcpSubscription: Nullable<Subscription> = null;
  private _activeSockets = new Set<Socket>();

  constructor(deps: IPortForwardingTunnelDeps) {
    super(deps);
  }

  protected async _attachToSocket(socket: ISSHSocket): Promise<void> {
    const dstAddr = this._rule.destinationAddress;
    const dstPort = this._rule.destinationPort;
    if (!dstAddr || !dstPort) {
      throw new Error(`Remote forwarding rule ${this._rule.id} requires destinationAddress and destinationPort`);
    }
    const bindAddr = this._rule.bindAddress;
    const bindPort = this._rule.bindPort;

    // Note: bindPort 0 lets sshd pick an ephemeral port and return it.
    const grantedPort = await socket.forwardIn(bindAddr, bindPort);
    this._effectiveBindPort = grantedPort;

    this._tcpSubscription = socket.tcpConnection$.subscribe(({ details, accept, reject: rejectConn }) => {
      if (details.destPort !== this._effectiveBindPort) {
        // Belongs to another Remote rule sharing this socket.
        return;
      }
      const upstream = accept();
      const local = netConnect(dstPort, dstAddr);
      this._activeSockets.add(local);
      local.on('error', () => {
        this._activeSockets.delete(local);
        local.destroy();
        upstream.destroy();
      });
      upstream.on('error', () => {
        this._activeSockets.delete(local);
        local.destroy();
        upstream.destroy();
      });
      local.on('close', () => {
        this._activeSockets.delete(local);
        this._decActive();
      });

      this._incActive();
      if (this._meter) {
        // The 'local' end (toward dstAddr:dstPort) is the upstream from the
        // user-agent perspective: bytes flowing into 'local' originate from
        // the remote SSH server (i.e. our user agent on the other end).
        this._meter.attach(local, upstream);
      } else {
        local.pipe(upstream).pipe(local);
      }
    });
  }

  protected async _detachFromSocket(socket: ISSHSocket): Promise<void> {
    // Order matters: cancel forwardIn first so sshd stops dispatching new
    // tcp connections, then unsubscribe so any in-flight event is still
    // observed and accepted/refused cleanly.
    const bindAddr = this._rule.bindAddress;
    const port = this._effectiveBindPort ?? this._rule.bindPort;
    try {
      await socket.unforwardIn(bindAddr, port);
    } catch (err) {
      this._logService.warn(`[RemoteForwarding ${this._rule.id}] unforwardIn failed`, err);
    }
    this._tcpSubscription?.unsubscribe();
    this._tcpSubscription = null;
    for (const sock of this._activeSockets) {
      sock.destroy();
    }
    this._activeSockets.clear();
  }
}
