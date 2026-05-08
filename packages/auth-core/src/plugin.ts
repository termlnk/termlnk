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
import { AuthPlugin, IMasterKeyService, ISrpClientService, ITokenStorageService } from '@termlnk/auth';
import { DependentOn, InjectSelf, mergeOverrideWithDependencies, Plugin, registerDependencies } from '@termlnk/core';
import { DatabasePlugin } from '@termlnk/database';
import { MasterKeyService } from './services/master-key.service';
import { SrpClientService } from './services/srp-client.service';
import { TokenManager } from './services/token-manager.service';
import { TokenStorageService } from './services/token-storage.service';

export const AUTH_CORE_PLUGIN_NAME = 'AUTH_CORE_PLUGIN';

export interface IAuthCorePluginConfig {
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
 * 注册的服务：
 * - IMasterKeyService → MasterKeyService（password+salt → Argon2id → HKDF 三把子密钥）
 * - ISrpClientService → SrpClientService（5 步 SRP6a 握手）
 * - ITokenStorageService → TokenStorageService（加密持久化 ITokenPair）
 * - TokenManager（concrete class；access/refresh 缓存 + 自动续期）
 *
 * **暂未注册**（依赖 Phase 3 HTTP 层）：
 * - IAuthService（需要 SRP server 通信）
 * - ITokenRefresher（需要 /auth/refresh HTTP 端点）
 *
 * AuthService / HttpTokenRefresher 在 Phase 3 网络层落地后由独立 controller 注入。
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
    registerDependencies(this._injector, mergeOverrideWithDependencies(dependencies, this._config.override));
  }
}
