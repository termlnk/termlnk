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

import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { Server as HttpsServer } from 'node:https';
import type { Observable } from 'rxjs';
import type { IWebServerConfig } from '../controllers/config.schema';
import type { AnyRouter } from '../trpc/types';
import type { IRouteHandler } from './static-file.service';
import { readFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { createIdentifier, Disposable, IConfigService, ILogService, Inject, Injector } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';
import { WEB_SERVER_PLUGIN_CONFIG_KEY } from '../controllers/config.schema';
import { createTRPCStandaloneHandler } from '../trpc/http-handler';
import { IStaticFileService } from './static-file.service';

/** Web Server 运行时状态。 */
export type WebServerStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface IWebServerStateSnapshot {
  readonly status: WebServerStatus;
  /** running 时是 listen 上的 origin（含 protocol + host + port）；其它状态为 null。 */
  readonly origin: string | null;
  /** error 状态下的错误消息；其它状态为 null。 */
  readonly errorMessage: string | null;
}

const INITIAL_STATE: IWebServerStateSnapshot = {
  status: 'stopped',
  origin: null,
  errorMessage: null,
};

/**
 * IWebServerService —— Node http/https + tRPC standalone HTTP adapter 的封装。
 *
 * 职责（P7.1a 范围）：
 * - 启动 / 停止 HTTP(S) server
 * - 把 `/trpc/*` 请求转发到 tRPC standalone HTTP handler
 * - 把其它请求转发到 IStaticFileService（serve SPA dist）
 * - 暴露 `state$` 让 UI / 控制器订阅运行状态
 *
 * 不在 P7.1a 范围内：
 * - WebSocket subscription（P7.1b）
 * - SRP6a 解锁握手 + session cookie（P7.1c）
 *
 * 这两项由后续子任务通过 `mountRouteHandler(prefix, handler)` 注入。
 */
export interface IWebServerService {
  readonly state$: Observable<IWebServerStateSnapshot>;

  /** 同步快照——给立刻需要状态判断的调用方避免订阅。 */
  getState(): IWebServerStateSnapshot;

  /**
   * 启动 server。需先通过 setRouter 注入 tRPC router。
   * 重复 start 在 running 状态下是 no-op；error 状态下重置后重启。
   */
  start(): Promise<void>;

  /** 停止 server。stopped 状态下是 no-op。返回 Promise 在 server 完全 close 后 resolve。 */
  stop(): Promise<void>;

  /**
   * 注入 tRPC router——通常由 WebServerController 在 onReady 阶段把 desktop 同款
   * appRouter（来自 @termlnk/rpc-server）传进来。
   *
   * 必须在 start() 前调用，否则 start() 会抛错。
   */
  setRouter(router: AnyRouter): void;

  /**
   * 在 tRPC handler / 静态 SPA fallback 之外挂一个自定义路径前缀的 handler。
   * 用法：P7.1c 把 SRP6a 端点挂到 `/__termlnk-web/`；测试中可挂 health check 端点等。
   *
   * 多个 handler 按注册顺序匹配；先到先配；任一 handler 返回 true 即视为已处理。
   * 没有匹配则继续走 tRPC / 静态 SPA。
   */
  mountRouteHandler(prefix: string, handler: IRouteHandler): void;
}

export const IWebServerService = createIdentifier<IWebServerService>('web-server.service');

/**
 * Node http/https + tRPC standalone HTTP adapter 实现。
 *
 * 路由优先级（按注册顺序）：
 *   1. 自定义 mountRouteHandler 挂载的 handler（P7.1c SRP6a 用）
 *   2. /trpc/* → tRPC standalone HTTP handler
 *   3. 其它 → IStaticFileService（SPA dist + history fallback）
 *   4. 都不匹配 → 404
 */
export class WebServerService extends Disposable implements IWebServerService {
  private readonly _state$ = new BehaviorSubject<IWebServerStateSnapshot>(INITIAL_STATE);
  readonly state$: Observable<IWebServerStateSnapshot> = this._state$.asObservable();

  private _server: Server | HttpsServer | null = null;
  private _router: AnyRouter | null = null;
  private _trpcHandler: ((req: IncomingMessage, res: ServerResponse) => Promise<void> | void) | null = null;
  private readonly _customRoutes: Array<{ prefix: string; handler: IRouteHandler }> = [];

  constructor(
    @IConfigService private readonly _configService: IConfigService,
    @IStaticFileService private readonly _staticFileService: IStaticFileService,
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
    });
  }

  mountRouteHandler(prefix: string, handler: IRouteHandler): void {
    this._customRoutes.push({ prefix, handler });
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
      const protocol = config.tlsCert && config.tlsKey ? 'https' : 'http';
      const origin = `${protocol}://${config.host}:${config.port}`;
      this._state$.next({ status: 'running', origin, errorMessage: null });
      this._logService.log(`[WebServerService] listening on ${origin}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._state$.next({ status: 'error', origin: null, errorMessage: message });
      this._logService.error(`[WebServerService] failed to start: ${message}`);
      throw err;
    }
  }

  async stop(): Promise<void> {
    const server = this._server;
    if (!server) {
      return;
    }
    this._server = null;
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

        // 1. 自定义 mount handler（P7.1c 的 SRP6a 端点等）
        for (const route of this._customRoutes) {
          if (this._pathMatchesPrefix(pathname, route.prefix)) {
            const handled = await route.handler(req, res);
            if (handled) {
              return;
            }
          }
        }

        // 2. tRPC HTTP（query / mutation）
        if (this._pathMatchesPrefix(pathname, '/trpc')) {
          await this._trpcHandler!(req, res);
          return;
        }

        // 3. 静态 SPA（含 history fallback）
        const staticHandled = await this._staticFileService.handle(req, res);
        if (staticHandled) {
          return;
        }

        // 4. 兜底 404
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
      // once() 已是 one-shot——触发后自动移除自己；只需在对端事件触发时移除"另一边"，避免双触发
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
