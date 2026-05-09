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

import type { Injector } from '@termlnk/core';
import type { IRPCContext } from '@termlnk/rpc';
import type { Buffer } from 'node:buffer';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import type { AnyRouter } from './types';
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { WebSocketServer } from 'ws';

export interface ICreateTRPCWSHandlerOptions {
  readonly router: AnyRouter;
  readonly injector: Injector;
  /**
   * Heartbeat. Defaults to 30s ping / 5s pong-wait — recommended by
   * `@trpc/server/adapters/ws`. NAT / proxy commonly drops idle TCP at 60s,
   * so 30s ping keeps the connection alive.
   */
  readonly keepAlive?: { pingMs?: number; pongWaitMs?: number };
}

/**
 * Handle returned by createTRPCWSHandler — the owning service decides when to
 * dispatch upgrade events here and when to release.
 */
export interface ITRPCWSHandlerHandle {
  /** Apply a single HTTP `upgrade` event to this handler. Caller already filtered by URL. */
  handleUpgrade(req: IncomingMessage, socket: Socket, head: Buffer): void;
  /** Notify all clients to reconnect; useful when the server config changed mid-flight. */
  broadcastReconnect(): void;
  /** Tear down: terminate all clients and close the underlying WebSocketServer. */
  close(): Promise<void>;
}

/**
 * Expose the appRouter as a WebSocket subscription endpoint.
 *
 * Sibling of `createTRPCStandaloneHandler`: HTTP serves query/mutation, WS serves
 * subscriptions. Same router, two transports — tRPC v11 makes business code
 * transport-agnostic.
 *
 * The factory does NOT subscribe to `server.upgrade` itself. Path routing is the
 * owning service's responsibility (`WebServerService`), so multiple WS subsystems
 * (e.g. shared-terminal relay in Phase 5) can coexist on a single port without
 * each registering an `upgrade` listener and racing.
 */
export function createTRPCWSHandler(
  opts: ICreateTRPCWSHandlerOptions
): ITRPCWSHandlerHandle {
  const wss = new WebSocketServer({ noServer: true });

  const trpcHandle = applyWSSHandler({
    wss,
    router: opts.router,
    keepAlive: {
      enabled: true,
      pingMs: opts.keepAlive?.pingMs ?? 30_000,
      pongWaitMs: opts.keepAlive?.pongWaitMs ?? 5_000,
    },
    createContext: async (): Promise<IRPCContext> => {
      return { injector: opts.injector };
    },
  });

  return {
    handleUpgrade: (req, socket, head) => {
      wss.handleUpgrade(req, socket, head, (client) => {
        wss.emit('connection', client, req);
      });
    },
    broadcastReconnect: () => trpcHandle.broadcastReconnectNotification(),
    close: async () => {
      for (const client of wss.clients) {
        client.terminate();
      }
      await new Promise<void>((resolve) => {
        wss.close(() => resolve());
      });
    },
  };
}
