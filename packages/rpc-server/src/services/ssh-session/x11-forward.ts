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

import type { ClientChannel } from 'ssh2';
import net from 'node:net';
import path from 'node:path';

export interface IX11Target {
  type: 'unix' | 'tcp';
  host: string;
  port: number;
}

/**
 * Parse the DISPLAY environment variable into a connection target.
 *
 * Supported formats:
 *  - `/tmp/.X11-unix/X0`        → Unix socket (absolute path)
 *  - `:0` / `:0.0`              → Unix socket `/tmp/.X11-unix/X0`
 *  - `localhost:10.0`           → TCP 127.0.0.1:6010
 *  - `hostname:0`              → TCP hostname:6000
 */
export function parseDisplay(display: string | undefined): IX11Target | null {
  if (!display) {
    return null;
  }

  // Absolute path → Unix socket directly
  if (path.isAbsolute(display)) {
    return { type: 'unix', host: display, port: 0 };
  }

  // `:displayNum` or `:displayNum.screenNum` → Unix socket
  const localMatch = display.match(/^:(\d+)(?:\.\d+)?$/);
  if (localMatch) {
    const displayNum = Number.parseInt(localMatch[1], 10);
    return {
      type: 'unix',
      host: `/tmp/.X11-unix/X${displayNum}`,
      port: 0,
    };
  }

  // `host:displayNum` or `host:displayNum.screenNum` → TCP
  const tcpMatch = display.match(/^(.+):(\d+)(?:\.\d+)?$/);
  if (tcpMatch) {
    const host = tcpMatch[1] === 'localhost' ? '127.0.0.1' : tcpMatch[1];
    const displayNum = Number.parseInt(tcpMatch[2], 10);
    return {
      type: 'tcp',
      host,
      port: 6000 + displayNum,
    };
  }

  return null;
}

/**
 * Create a socket connection to the local X Server.
 */
export function connectToXServer(target: IX11Target): net.Socket {
  if (target.type === 'unix') {
    return net.connect(target.host);
  }
  return net.connect(target.port, target.host);
}

/**
 * Bridge an SSH X11 channel to a local X Server socket with bidirectional piping.
 * Returns a cleanup function that tears down both sides.
 */
export function bridgeX11Channel(channel: ClientChannel, socket: net.Socket, onError?: (err: Error) => void): () => void {
  let cleaned = false;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    channel.unpipe(socket);
    socket.unpipe(channel);
    channel.destroy();
    socket.destroy();
  };

  channel.pipe(socket);
  socket.pipe(channel);

  channel.on('close', cleanup);
  socket.on('close', cleanup);

  channel.on('error', (err: Error) => {
    onError?.(err);
    cleanup();
  });
  socket.on('error', (err: Error) => {
    onError?.(err);
    cleanup();
  });

  return cleanup;
}
