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
import { AuthController } from './controllers/auth.controller';
import { defaultPluginConfig, WEB_SERVER_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { WebServerController } from './controllers/web-server.controller';
import { IMasterKeyHolderService, MasterKeyHolderService } from './services/master-key-holder.service';
import { IStaticFileService, StaticFileService } from './services/static-file.service';
import { IWebServerService, WebServerService } from './services/web-server.service';
import { IWebSessionService, WebSessionService } from './services/web-session.service';

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
 * 3. Provide a master password through `masterPassword*` config (literal /
 *    file path / env var name). Browser never sees the master password —
 *    deployer-supplied secrets are the only entry point.
 *
 * In scope for P7.1a/b/c:
 * - HTTP server lifecycle (start / stop).
 * - tRPC standalone HTTP adapter (query / mutation).
 * - tRPC WebSocket subscription adapter.
 * - Static SPA hosting (dist + history fallback).
 * - Master-key holder seeded from env / file (Argon2id derives master key +
 *   sub-keys + access verifier; all in process memory, never persisted).
 * - Browser login / logout / status endpoints under `/__termlnk-web/*` with
 *   session cookie + idle 30-minute eviction.
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
      [IMasterKeyHolderService, { useClass: MasterKeyHolderService }],
      [IWebSessionService, { useClass: WebSessionService }],
      [WebServerController],
      [AuthController],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config?.override));
  }

  override onReady(): void {
    touchDependencies(this._injector, [
      [WebServerController],
      [AuthController],
    ]);

    // Mount auth routes before starting the server so login/status are reachable
    // even while the master-key holder is still running Argon2id; meanwhile
    // initialize() runs fire-and-forget — its result is published on state$.
    const authController = this._injector.get(AuthController);
    authController.mountAndInit();

    // start() is async; Plugin.onReady does not await it — state$ surfaces the result.
    const controller = this._injector.get(WebServerController);
    void controller.startServer();
  }
}
