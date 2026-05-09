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

import type { IDeviceNameProvider, IMasterKeyService, ISrpClientService } from '@termlnk/auth';
import type { Dependency, DependencyOverride, Injector } from '@termlnk/core';
import { AuthPlugin, IAuthClientService, IAuthService, IDeviceNameProvider as IDeviceNameProviderId, IMasterKeyService as IMasterKeyServiceId, ISrpClientService as ISrpClientServiceId, ITokenRefresher, ITokenStorageService } from '@termlnk/auth';
// Deep imports：绕开 @termlnk/auth-core/index.ts 对 AuthCorePlugin 的 re-export，
// 因为后者会拉入 @termlnk/database（含 better-sqlite3 native module，不可在浏览器运行）。
// 仅取与 vault 加解密 / SRP 握手 / token 管理这一组无 DB 依赖的服务类。
// `./*: ./src/*` 子路径导出要求显式 `.ts` 扩展名。
import { HttpAuthService } from '@termlnk/auth-core/services/http-auth.service.ts';
import { HttpTokenRefresher } from '@termlnk/auth-core/services/http-token-refresher.service.ts';
import { MasterKeyService } from '@termlnk/auth-core/services/master-key.service.ts';
import { SrpClientService } from '@termlnk/auth-core/services/srp-client.service.ts';
import { TokenManager } from '@termlnk/auth-core/services/token-manager.service.ts';
import { DependentOn, ILogService, InjectSelf, mergeOverrideWithDependencies, Plugin, registerDependencies, touchDependencies } from '@termlnk/core';
import { ISyncCryptoService, ISyncTransportService, SyncPlugin } from '@termlnk/sync';
// 同样原因 deep import @termlnk/sync-core 的纯加密 / 传输服务——避免 SyncCorePlugin
// 拉入 @termlnk/database（outbox / synchroniser / backup 都强依赖 SQLite 仓库）。
import { SyncCryptoService } from '@termlnk/sync-core/services/crypto.service.ts';
import { HttpSyncTransportService } from '@termlnk/sync-core/services/http-transport.service.ts';
import { AuthClientBridgeService } from '../services/auth-client-bridge.service';
import { BrowserDeviceNameProvider } from '../services/browser-device-name-provider.service';
import { BrowserVaultService, IBrowserVaultService } from '../services/browser-vault.service';
import { InMemoryTokenStorageService } from '../services/in-memory-token-storage.service';

export const WEB_AUTH_CORE_PLUGIN_NAME = 'WEB_AUTH_CORE_PLUGIN';

export interface IWebAuthCorePluginConfig {
  /** 云服务根（含版本前缀，如 `https://cloud.termlnk.io/v1`）。空则不注册 HTTP impl。 */
  cloudBaseUrl?: string;
  override?: DependencyOverride;
}

/**
 * Web 端 Auth Core 插件——浏览器实现的注册中心。
 *
 * 与 `@termlnk/auth-core/AuthCorePlugin` 的差异：
 * 1. **不依赖 DatabasePlugin** —— 浏览器没有 SQLite；token 由 InMemoryTokenStorageService 持有
 * 2. **设备名 from navigator.userAgent** —— 替代 OsHostnameDeviceNameProvider 的 `os.hostname()`
 * 3. **同进程暴露 IAuthClientService** —— 桌面端走 tRPC，浏览器直接桥接 IAuthService
 *
 * 不复用 AuthCorePlugin 通过 override 替换是因为后者的 plugin-level @DependentOn(DatabasePlugin)
 * 是硬约束，浏览器无法满足。复制服务注册列表是 first-principles 上更干净的解。
 */
@DependentOn(AuthPlugin, SyncPlugin)
export class WebAuthCorePlugin extends Plugin {
  static override pluginName = WEB_AUTH_CORE_PLUGIN_NAME;

  constructor(
    private readonly _config: IWebAuthCorePluginConfig = {},
    @InjectSelf() protected readonly _injector: Injector
  ) {
    super();
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [IMasterKeyServiceId, { useClass: MasterKeyService }],
      [ISrpClientServiceId, { useClass: SrpClientService }],
      [ITokenStorageService, { useClass: InMemoryTokenStorageService }],
      [TokenManager, { useClass: TokenManager }],
      [IDeviceNameProviderId, { useClass: BrowserDeviceNameProvider }],
    ];

    if (this._config.cloudBaseUrl) {
      const baseUrl = this._config.cloudBaseUrl;
      dependencies.push(
        [ITokenRefresher, {
          // eslint-disable-next-line react/no-unnecessary-use-prefix, react/component-hook-factories
          useFactory: (logService: ILogService) => new HttpTokenRefresher({ baseUrl }, logService),
          deps: [ILogService],
        }],
        [IAuthService, {
          // eslint-disable-next-line react/no-unnecessary-use-prefix, react/component-hook-factories
          useFactory: (
            masterKey: IMasterKeyService,
            srp: ISrpClientService,
            tokenManager: TokenManager,
            logService: ILogService,
            deviceNameProvider: IDeviceNameProvider
          ) => new HttpAuthService(
            { baseUrl },
            masterKey,
            srp,
            tokenManager,
            logService,
            deviceNameProvider
          ),
          deps: [IMasterKeyServiceId, ISrpClientServiceId, TokenManager, ILogService, IDeviceNameProviderId],
        }],
        [IAuthClientService, { useClass: AuthClientBridgeService }],
        // Sync 层服务——只引 crypto + transport；浏览器不做 push / outbox / synchroniser 编排，
        // BrowserVaultService 单独承担 pull-only 状态机（详见 services/browser-vault.service.ts）
        [ISyncCryptoService, { useClass: SyncCryptoService }],
        [ISyncTransportService, {
          // eslint-disable-next-line react/no-unnecessary-use-prefix, react/component-hook-factories
          useFactory: (tokenManager: TokenManager, logService: ILogService) =>
            new HttpSyncTransportService({ baseUrl }, tokenManager, logService),
          deps: [TokenManager, ILogService],
        }],
        [IBrowserVaultService, { useClass: BrowserVaultService }]
      );
    }

    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config.override));
  }

  override onReady(): void {
    if (!this._config.cloudBaseUrl) {
      return;
    }
    // touch BrowserVaultService 让它构造，从而订阅 authState$ 启动 pull 流程。
    touchDependencies(this._injector, [
      [IBrowserVaultService],
    ]);
  }
}
