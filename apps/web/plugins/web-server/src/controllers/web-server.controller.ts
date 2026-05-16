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

import type { AnyRouter } from '../trpc/types';
import { createIdentifier, Disposable, ILogService, Inject } from '@termlnk/core';
import { IWebServerService } from '../services/web-server.service';

/**
 * IWebServerRouterProvider — DI source that yields the tRPC router for IWebServerService.
 *
 * apps/web/server overrides this token at `registerPlugin` time, e.g.:
 *
 * ```ts
 * core.registerPlugin(WebServerPlugin, {
 *   override: [[IWebServerRouterProvider, {
 *     useFactory: () => ({ getRouter: () => createWebAppRouter() }),
 *     deps: [],
 *   }]],
 * });
 * ```
 *
 * Sibling of @termlnk/electron-main's `createDesktopAppRouter`. Desktop imports
 * and composes the router directly inside RPCController; web-server stays
 * router-shape-agnostic and lets the edge process wire it via DI.
 */
export interface IWebServerRouterProvider {
  getRouter(): AnyRouter;
}

export const IWebServerRouterProvider = createIdentifier<IWebServerRouterProvider>('web-server.router-provider');

/**
 * WebServerController — bridge between plugin lifecycle and IWebServerService startup.
 *
 * Flow:
 * 1. onStarting: DI registration (handled inside plugin.ts).
 * 2. onReady (Plugin.onReady phase):
 *    a. Pull the router from IWebServerRouterProvider.
 *    b. webServerService.setRouter(router).
 *    c. webServerService.start().
 * 3. dispose: trigger webServerService.stop().
 *
 * We deliberately do not start inside the constructor: during Plugin.onStarting,
 * repositories / services are still being constructed, so the router's
 * procedures may NPE while resolving dependencies. Plugin.onReady is the
 * steady state where every dependency is wired up.
 */
export class WebServerController extends Disposable {
  constructor(
    @Inject(IWebServerService) private readonly _webServerService: IWebServerService,
    @Inject(IWebServerRouterProvider) private readonly _routerProvider: IWebServerRouterProvider,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  override dispose(): void {
    super.dispose();
    void this._webServerService.stop().catch((err) => {
      this._logService.warn(`[WebServerController] stop on dispose failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  /**
   * Called by WebServerPlugin.onReady.
   *
   * Errors are swallowed here on purpose: when `start()` fails, IWebServerService
   * has already flipped `state$` to 'error', and UI / monitoring can read that
   * to decide how to degrade. The plugin chain should not crash just because
   * the server cannot bind — the SQLite vault still serves offline reads.
   */
  async startServer(): Promise<void> {
    try {
      const router = this._routerProvider.getRouter();
      this._webServerService.setRouter(router);
      await this._webServerService.start();
    } catch (err) {
      this._logService.error(`[WebServerController] startServer failed: ${err instanceof Error ? err.stack : String(err)}`);
    }
  }
}
