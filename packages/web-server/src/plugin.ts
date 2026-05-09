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

import type { Dependency, Injector } from '@termlnk/core';
import type { IWebServerConfig } from './controllers/config.schema';
import { DependentOn, IConfigService, Inject, InjectSelf, merge, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { RPCServerPlugin } from '@termlnk/rpc-server';
import { defaultPluginConfig, WEB_SERVER_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { WebServerController } from './controllers/web-server.controller';
import { IStaticFileService, StaticFileService } from './services/static-file.service';
import { IWebServerService, WebServerService } from './services/web-server.service';

export const WEB_SERVER_PLUGIN_NAME = 'WEB_SERVER_PLUGIN';

/**
 * WebServerPlugin —— termlnk-web 进程的 HTTP/WS 入口。
 *
 * 与 ElectronMainPlugin 形态对齐：都依赖 RPCServerPlugin，差别在 transport——
 * Electron 用 IPC 暴露 router，web 用 Node http + tRPC standalone adapter。
 *
 * 使用方需要：
 * 1. 通过 plugin config 提供 staticRoot / port 等配置
 * 2. **必须**通过 `override` 注入 IWebServerRouterProvider，否则 onReady 阶段抛错
 *    （契约层不依赖具体的 appRouter 形状——desktop main 直接 import & 组合 router；
 *    web 走 DI 让上层进程 apps/web/server 自己组装）
 *
 * P7.1a 范围：
 * - HTTP server 启动 / 停止
 * - tRPC standalone HTTP adapter（query / mutation）
 * - 静态 SPA 托管（dist + history fallback）
 *
 * 后续子任务：
 * - P7.1b：ws subscription adapter
 * - P7.1c：SRP6a master password 解锁握手 + session cookie + idle 30 min
 */
@DependentOn(RPCServerPlugin)
export class WebServerPlugin extends Plugin {
  static override pluginName = WEB_SERVER_PLUGIN_NAME;

  constructor(
    private readonly _config: IWebServerConfig = defaultPluginConfig,
    @InjectSelf() protected readonly _injector: Injector,
    @Inject(IConfigService) private readonly _configService: IConfigService
  ) {
    super();

    const merged = merge({}, defaultPluginConfig, this._config);
    this._configService.setConfig(WEB_SERVER_PLUGIN_CONFIG_KEY, merged);
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [IStaticFileService, { useClass: StaticFileService }],
      [IWebServerService, { useClass: WebServerService }],
      [WebServerController],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config?.override));
  }

  override onReady(): void {
    touchDependencies(this._injector, [
      [WebServerController],
    ]);

    // start() 是异步的；Plugin.onReady 不需要等它——server 自己用 state$ 上报
    const controller = this._injector.get(WebServerController);
    void controller.startServer();
  }
}
