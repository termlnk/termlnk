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

import type { Dependency, DependencyOverride, Injector } from '@termlnk/core';
import { AuthPlugin, IAuthService, IMasterKeyService, ISrpClientService, ITokenRefresher, ITokenStorageService } from '@termlnk/auth';
import { DependentOn, ILogService, InjectSelf, mergeOverrideWithDependencies, Plugin, registerDependencies } from '@termlnk/core';
import { DatabasePlugin } from '@termlnk/database';
import { HttpAuthService } from './services/http-auth.service';
import { HttpTokenRefresher } from './services/http-token-refresher.service';
import { MasterKeyService } from './services/master-key.service';
import { SrpClientService } from './services/srp-client.service';
import { TokenManager } from './services/token-manager.service';
import { TokenStorageService } from './services/token-storage.service';

export const AUTH_CORE_PLUGIN_NAME = 'AUTH_CORE_PLUGIN';

export interface IAuthCorePluginConfig {
  /**
   * 云服务根（含版本前缀，如 `https://cloud.termlnk.io/v1`）。
   *
   * 配置后会自动注册：
   * - IAuthService → HttpAuthService（绑定到该 baseUrl）
   * - ITokenRefresher → HttpTokenRefresher（绑定到该 baseUrl）
   *
   * 不配置时这两个服务保持未绑定状态——AuthGate 等组件用 Quantity.OPTIONAL
   * 注入会得到 null，UI 自动呈现"未配置云服务"占位。
   *
   * Phase 3 公开测试 / self-host 部署后，desktop main bootstrap 通过本字段
   * 一次激活整个云端登录链。
   */
  cloudBaseUrl?: string;

  /** Override 列表，便于测试和 desktop main 替换具体实现。 */
  override?: DependencyOverride;
}

/**
 * Auth Core 插件——主进程实现的注册中心。
 *
 * 依赖：
 * - DatabasePlugin（TokenStorageService 使用 ConfigRepository + ISecretCipherService）
 * - AuthPlugin（契约层 config key + DI 标识符）
 *
 * 始终注册的服务：
 * - IMasterKeyService → MasterKeyService（password+salt → Argon2id → HKDF 三把子密钥）
 * - ISrpClientService → SrpClientService（5 步 SRP6a 握手）
 * - ITokenStorageService → TokenStorageService（加密持久化 ITokenPair）
 * - TokenManager（concrete class；access/refresh 缓存 + 自动续期）
 *
 * 仅当 `cloudBaseUrl` 配置时注册：
 * - IAuthService → HttpAuthService（SRP6a register/login/logout over HTTP）
 * - ITokenRefresher → HttpTokenRefresher（POST /auth/refresh）
 */
@DependentOn(DatabasePlugin, AuthPlugin)
export class AuthCorePlugin extends Plugin {
  static override pluginName = AUTH_CORE_PLUGIN_NAME;

  constructor(
    private readonly _config: IAuthCorePluginConfig = {},
    @InjectSelf() protected readonly _injector: Injector
  ) {
    super();
  }

  override onStarting(): void {
    const dependencies: Dependency[] = [
      [IMasterKeyService, { useClass: MasterKeyService }],
      [ISrpClientService, { useClass: SrpClientService }],
      [ITokenStorageService, { useClass: TokenStorageService }],
      [TokenManager, { useClass: TokenManager }],
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
            logService: ILogService
          ) => new HttpAuthService(
            { baseUrl },
            masterKey,
            srp,
            tokenManager,
            logService
          ),
          deps: [IMasterKeyService, ISrpClientService, TokenManager, ILogService],
        }]
      );
    }

    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config.override));
  }
}
