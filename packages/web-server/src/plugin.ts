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
 * WebServerPlugin — HTTP/WS entry point for the termlnk-web process.
 *
 * Mirrors ElectronMainPlugin in shape: both depend on RPCServerPlugin and only
 * differ in transport. Electron exposes the router over IPC; web exposes it
 * over Node http with the tRPC standalone HTTP adapter plus a WS adapter.
 *
 * Caller responsibilities:
 * 1. Pass `staticRoot` / `port` / TLS material via plugin config.
 * 2. **Must** override `IWebServerRouterProvider` to supply the appRouter.
 *    The package is intentionally agnostic about the router shape so
 *    apps/web/server can wire its own composition at the edge.
 *
 * In scope for P7.1a/b:
 * - HTTP server lifecycle (start / stop).
 * - tRPC standalone HTTP adapter (query / mutation).
 * - Static SPA hosting (dist + history fallback).
 * - tRPC WebSocket subscription adapter (P7.1b).
 *
 * Out of scope (P7.1c):
 * - SRP6a master-password unlock handshake.
 * - Session cookie + idle 30-min auto-clear of master key.
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

    // start() is async; Plugin.onReady does not await it — state$ surfaces the result.
    const controller = this._injector.get(WebServerController);
    void controller.startServer();
  }
}
