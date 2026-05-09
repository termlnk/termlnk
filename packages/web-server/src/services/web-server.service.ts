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

import type { Buffer } from 'node:buffer';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { Server as HttpsServer } from 'node:https';
import type { Observable } from 'rxjs';
import type { IWebServerConfig } from '../controllers/config.schema';
import type { AnyRouter } from '../trpc/types';
import type { ITRPCWSHandlerHandle } from '../trpc/ws-handler';
import type { IRouteHandler } from './static-file.service';
import { readFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { createIdentifier, Disposable, IConfigService, ILogService, Inject, Injector } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';
import { TRPC_WS_PATH, WEB_SERVER_PLUGIN_CONFIG_KEY } from '../controllers/config.schema';
import { createTRPCStandaloneHandler } from '../trpc/http-handler';
import { createTRPCWSHandler } from '../trpc/ws-handler';
import { IStaticFileService } from './static-file.service';
import { IWebSessionService } from './web-session.service';

/** Lifecycle status of the web server. */
export type WebServerStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface IWebServerStateSnapshot {
  readonly status: WebServerStatus;
  /** Origin string (`<protocol>://<host>:<port>`) while running, otherwise null. */
  readonly origin: string | null;
  /** Error message while in error state, otherwise null. */
  readonly errorMessage: string | null;
}

const INITIAL_STATE: IWebServerStateSnapshot = {
  status: 'stopped',
  origin: null,
  errorMessage: null,
};

/**
 * IWebServerService — Node http/https plus tRPC HTTP/WS adapters.
 *
 * Responsibilities:
 * - Start / stop the HTTP(S) server.
 * - Dispatch `/trpc/*` to the tRPC standalone HTTP handler (query/mutation).
 * - Dispatch upgrades on `/trpc-ws` to the tRPC WebSocket handler (subscription).
 * - Reject upgrades on any other path so unknown paths cannot hold sockets open.
 * - Forward everything else to IStaticFileService (SPA dist).
 * - Expose `state$` so UI / controllers can observe lifecycle.
 *
 * SRP6a master-password unlock + session cookie (P7.1c) plug in via
 * `mountRouteHandler(prefix, handler)` without changing this service.
 */
export interface IWebServerService {
  readonly state$: Observable<IWebServerStateSnapshot>;

  /** Synchronous snapshot for callers that need state without subscribing. */
  getState(): IWebServerStateSnapshot;

  /**
   * Start the server. `setRouter` must be called first; otherwise `start`
   * throws and the state stays `stopped` (caller misuse, not a runtime error).
   * Calling `start` while `running` or `starting` is a no-op.
   */
  start(): Promise<void>;

  /** Stop the server. No-op when `stopped`. Resolves once the server is fully closed. */
  stop(): Promise<void>;

  /**
   * Inject the tRPC router. Typically wired in `WebServerController.onReady`
   * with the same appRouter desktop already exposes via Electron IPC
   * (`@termlnk/rpc-server`). Must be called before `start`.
   */
  setRouter(router: AnyRouter): void;

  /**
   * Mount a custom HTTP handler under a given path prefix (P7.1c uses this
   * for `/__termlnk-web/login/*`, tests can mount health-check endpoints, ...).
   * Handlers run in registration order before tRPC / static SPA. A handler
   * returning `true` short-circuits the chain; `false` lets the request fall
   * through.
   */
  mountRouteHandler(prefix: string, handler: IRouteHandler): void;

  /**
   * Tell every active WebSocket client to reconnect. Useful when the server
   * config changed mid-flight (SRP session invalidated, router upgraded).
   * No-op while stopped.
   */
  broadcastReconnect(): void;
}

export const IWebServerService = createIdentifier<IWebServerService>('web-server.service');

/**
 * Default IWebServerService implementation.
 *
 * Routing priority for HTTP requests:
 *   1. Custom `mountRouteHandler` handlers (e.g. P7.1c SRP6a endpoints).
 *   2. `/trpc/*` -> tRPC standalone HTTP handler.
 *   3. Anything else -> IStaticFileService (SPA dist + history fallback).
 *   4. 404 fallback.
 *
 * For HTTP `upgrade`:
 *   - `/trpc-ws` -> tRPC WebSocket handler.
 *   - Anything else -> `socket.destroy()` (immediate rejection).
 */
export class WebServerService extends Disposable implements IWebServerService {
  private readonly _state$ = new BehaviorSubject<IWebServerStateSnapshot>(INITIAL_STATE);
  readonly state$: Observable<IWebServerStateSnapshot> = this._state$.asObservable();

  private _server: Server | HttpsServer | null = null;
  private _router: AnyRouter | null = null;
  private _trpcHandler: ((req: IncomingMessage, res: ServerResponse) => Promise<void> | void) | null = null;
  private _wsHandle: ITRPCWSHandlerHandle | null = null;
  private _upgradeListener: ((req: IncomingMessage, socket: import('node:net').Socket, head: Buffer) => void) | null = null;
  private readonly _customRoutes: Array<{ prefix: string; handler: IRouteHandler }> = [];

  constructor(
    @IConfigService private readonly _configService: IConfigService,
    @IStaticFileService private readonly _staticFileService: IStaticFileService,
    @IWebSessionService private readonly _sessionService: IWebSessionService,
    @Inject(Injector) private readonly _injector: Injector,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  override dispose(): void {
    super.dispose();
    void this.stop();
    this._state$.complete();
  }

  getState(): IWebServerStateSnapshot {
    return this._state$.getValue();
  }

  setRouter(router: AnyRouter): void {
    this._router = router;
    this._trpcHandler = createTRPCStandaloneHandler({
      router,
      injector: this._injector,
      basePath: '/trpc',
      // Cookie-based session check. WebSessionService.resolveFromRequest also
      // bumps lastActivityAt on hit, so RPC traffic naturally keeps the
      // session alive past the idle timeout.
      authenticate: (req) => this._sessionService.resolveFromRequest(req) !== null,
    });
  }

  mountRouteHandler(prefix: string, handler: IRouteHandler): void {
    this._customRoutes.push({ prefix, handler });
  }

  broadcastReconnect(): void {
    this._wsHandle?.broadcastReconnect();
  }

  async start(): Promise<void> {
    const current = this._state$.getValue();
    if (current.status === 'running' || current.status === 'starting') {
      return;
    }

    if (!this._router || !this._trpcHandler) {
      throw new Error('[WebServerService] start() called before setRouter() — tRPC router not injected');
    }

    this._state$.next({ ...INITIAL_STATE, status: 'starting' });

    const config = this._resolveConfig();
    const requestListener = this._buildRequestListener();

    try {
      this._server = await this._listen(config, requestListener);

      // tRPC subscription over WebSocket — single shared port with HTTP.
      // Same router across both transports: query/mutation -> HTTP, subscription -> WS.
      // The cookie gate at upgrade time prevents unauthenticated peers from
      // even establishing a WebSocket; touch the session on each upgrade so
      // the act of opening a long-lived WS itself counts as activity.
      this._wsHandle = createTRPCWSHandler({
        router: this._router!,
        injector: this._injector,
        authenticate: (req) => this._sessionService.resolveFromRequest(req) !== null,
      });

      // Single upgrade dispatcher: route /trpc-ws to the tRPC WS handler;
      // everything else is rejected immediately so unmatched upgrades don't
      // hang the socket (e.g. someone hitting an unknown path with `wscat`).
      this._upgradeListener = (req, socket, head) => {
        const pathname = (req.url ?? '').split('?')[0];
        if (pathname === TRPC_WS_PATH) {
          this._wsHandle?.handleUpgrade(req, socket, head);
          return;
        }
        socket.destroy();
      };
      this._server.on('upgrade', this._upgradeListener);

      const protocol = config.tlsCert && config.tlsKey ? 'https' : 'http';
      const origin = `${protocol}://${config.host}:${config.port}`;
      this._state$.next({ status: 'running', origin, errorMessage: null });
      this._logService.log(`[WebServerService] listening on ${origin} (HTTP /trpc, WS ${TRPC_WS_PATH})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._state$.next({ status: 'error', origin: null, errorMessage: message });
      this._logService.error(`[WebServerService] failed to start: ${message}`);
      throw err;
    }
  }

  async stop(): Promise<void> {
    const server = this._server;
    const wsHandle = this._wsHandle;
    const upgradeListener = this._upgradeListener;
    if (!server) {
      return;
    }
    this._server = null;
    this._wsHandle = null;
    this._upgradeListener = null;

    // Order matters: detach upgrade listener first so no new WS connections
    // race against teardown; then drop active WS clients; finally close HTTP.
    // Plain `server.close()` only stops new HTTP connections, it does not
    // touch upgraded WebSocket connections.
    if (upgradeListener) {
      server.removeListener('upgrade', upgradeListener);
    }
    if (wsHandle) {
      await wsHandle.close();
    }
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    this._state$.next({ ...INITIAL_STATE, status: 'stopped' });
    this._logService.log('[WebServerService] stopped');
  }

  private _resolveConfig(): Required<Pick<IWebServerConfig, 'port' | 'host'>> & Pick<IWebServerConfig, 'staticRoot' | 'tlsCert' | 'tlsKey'> {
    const cfg = this._configService.getConfig<IWebServerConfig>(WEB_SERVER_PLUGIN_CONFIG_KEY) ?? {};
    return {
      port: cfg.port ?? 3000,
      host: cfg.host ?? '127.0.0.1',
      staticRoot: cfg.staticRoot,
      tlsCert: cfg.tlsCert,
      tlsKey: cfg.tlsKey,
    };
  }

  private _buildRequestListener() {
    return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      try {
        const pathname = this._extractPathname(req.url ?? '/');

        // 1. Custom mounted handlers (P7.1c SRP6a endpoints, etc.).
        for (const route of this._customRoutes) {
          if (this._pathMatchesPrefix(pathname, route.prefix)) {
            const handled = await route.handler(req, res);
            if (handled) {
              return;
            }
          }
        }

        // 2. tRPC HTTP (query / mutation).
        if (this._pathMatchesPrefix(pathname, '/trpc')) {
          await this._trpcHandler!(req, res);
          return;
        }

        // 3. Static SPA (with history fallback).
        const staticHandled = await this._staticFileService.handle(req, res);
        if (staticHandled) {
          return;
        }

        // 4. 404 fallback.
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Not Found');
      } catch (err) {
        this._logService.error(`[WebServerService] request handler error: ${err instanceof Error ? err.stack : String(err)}`);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('Internal Server Error');
        } else {
          res.end();
        }
      }
    };
  }

  private _extractPathname(url: string): string {
    const qIdx = url.indexOf('?');
    return qIdx === -1 ? url : url.slice(0, qIdx);
  }

  private _pathMatchesPrefix(pathname: string, prefix: string): boolean {
    if (pathname === prefix) {
      return true;
    }
    return pathname.startsWith(`${prefix}/`);
  }

  private async _listen(
    config: Required<Pick<IWebServerConfig, 'port' | 'host'>> & Pick<IWebServerConfig, 'tlsCert' | 'tlsKey'>,
    listener: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void
  ): Promise<Server | HttpsServer> {
    const useHttps = Boolean(config.tlsCert && config.tlsKey);
    let server: Server | HttpsServer;

    if (useHttps) {
      const [cert, key] = await Promise.all([
        readFile(config.tlsCert!),
        readFile(config.tlsKey!),
      ]);
      server = createHttpsServer({ cert, key }, listener);
    } else {
      server = createHttpServer(listener);
    }

    return new Promise<Server | HttpsServer>((resolve, reject) => {
      // `once()` is one-shot already — each handler removes itself on fire.
      // We only need to remove the *other* handler when one fires, to avoid
      // a late-arriving event leaving a dangling listener.
      function onListening(this: Server | HttpsServer): void {
        server.removeListener('error', onError);
        resolve(server);
      }
      function onError(this: Server | HttpsServer, err: Error): void {
        server.removeListener('listening', onListening);
        reject(err);
      }
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(config.port, config.host);
    });
  }
}
