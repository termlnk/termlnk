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
import { BootConfigController } from './controllers/boot-config.controller';
import { defaultPluginConfig, WEB_SERVER_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
import { IWebServerRouterProvider, WebServerController } from './controllers/web-server.controller';
import { IMasterKeyHolderService, MasterKeyHolderService } from './services/master-key-holder.service';
import { IStaticFileService, StaticFileService } from './services/static-file.service';
import { IWebServerService, WebServerService } from './services/web-server.service';
import { IWebSessionService, WebSessionService } from './services/web-session.service';

export const WEB_SERVER_PLUGIN_NAME = 'WEB_SERVER_PLUGIN';

// HTTP/WS entry point for the termlnk-web process. Mirrors ElectronMainPlugin in shape:
// both depend on RPCServerPlugin and only differ in transport (IPC vs Node http+ws).
//
// Caller responsibilities:
//   1. Pass `staticRoot` / `port` / TLS material via plugin config.
//   2. Override IWebServerRouterProvider to supply the appRouter — the package is
//      intentionally router-shape agnostic.
//   3. Provide a master password via `masterPassword*` config (literal/file/env). The
//      browser never sees it; deployer-supplied secrets are the only entry point.
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
      // IWebServerRouterProvider must always be supplied by the edge process
      // (apps/web/server) via plugin config override. Register a placeholder
      // here so `mergeOverrideWithDependencies` recognises the identifier and
      // can swap in the real provider — without this entry the plugin's
      // override mechanism silently drops the binding because it only
      // replaces existing dependencies.
      [IWebServerRouterProvider, {
        // eslint-disable-next-line react/no-unnecessary-use-prefix, react/component-hook-factories
        useFactory: () => {
          throw new Error('[WebServerPlugin] IWebServerRouterProvider was not overridden in plugin config — the edge process must inject the appRouter via `override: [[IWebServerRouterProvider, { useValue: { getRouter: () => appRouter } }]]`.');
        },
      }],
      [WebServerController],
      [AuthController],
      [BootConfigController],
    ];
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config?.override));
  }

  override onReady(): void {
    touchDependencies(this._injector, [
      [WebServerController],
      [AuthController],
      [BootConfigController],
    ]);

    // Mount auth routes before starting the server so login/status are reachable
    // even while the master-key holder is still running Argon2id; meanwhile
    // initialize() runs fire-and-forget — its result is published on state$.
    const authController = this._injector.get(AuthController);
    authController.mountAndInit();

    // Mount /boot/ui-config so the SPA can seed the initial theme without a
    // session (unauthenticated, UI-preference-only endpoint).
    this._injector.get(BootConfigController).mount();

    // start() is async; Plugin.onReady does not await it — state$ surfaces the result.
    const controller = this._injector.get(WebServerController);
    void controller.startServer();
  }
}
