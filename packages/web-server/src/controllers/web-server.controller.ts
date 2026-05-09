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
 * IWebServerRouterProvider —— 把 tRPC router 注入给 IWebServerService 的来源。
 *
 * 由 apps/web/server 进程入口在 registerPlugin 时 override，比如：
 *
 * ```ts
 * core.registerPlugin(WebServerPlugin, {
 *   override: [[IWebServerRouterProvider, { useFactory: () => ({ getRouter: () => createWebAppRouter() }), deps: [] }]]
 * });
 * ```
 *
 * 与 @termlnk/electron-main 的 createDesktopAppRouter 平行——
 * desktop 在 RPCController 内部直接 import & 组合 router；
 * web 走 DI 注入，避免 web-server 包硬绑业务 router 的具体形状。
 */
export interface IWebServerRouterProvider {
  getRouter(): AnyRouter;
}

export const IWebServerRouterProvider = createIdentifier<IWebServerRouterProvider>('web-server.router-provider');

/**
 * WebServerController —— Plugin 生命周期与 IWebServerService 启动节奏的桥。
 *
 * 流程：
 * 1. onStarting：DI 注册（在 plugin.ts 完成）
 * 2. onReady（Plugin.onReady 阶段触发）：
 *    a. 从 IWebServerRouterProvider 取 router
 *    b. webServerService.setRouter(router)
 *    c. webServerService.start()
 * 3. dispose：触发 webServerService.stop()
 *
 * 不直接在构造函数里 start —— Plugin onStarting → Repositories / Services 还在构造，
 * router 里的 procedures 解析依赖时可能 NPE。Plugin onReady 是所有依赖 ready 后的稳态。
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
   * 由 WebServerPlugin.onReady 调用。
   *
   * 错误不向 Plugin 抛——start 失败时 webServerService.state$ 已切到 'error'，
   * UI / 监控可以读到错误状态决定如何降级。Plugin 链不应该因 server 起不来而崩溃，
   * 比如 SQLite vault 还能离线访问。
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
