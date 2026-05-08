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

import type { ITokenPair, ITokenStorageService } from '@termlnk/auth';
import { AUTH_PLUGIN_CONFIG_KEY } from '@termlnk/auth';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { ConfigRepository, ISecretCipherService } from '@termlnk/database';

const TOKENS_FIELD = 'tokens';

/**
 * Token 持久化实现：JSON.stringify(ITokenPair) → ISecretCipherService 加密 → ConfigRepository.setField。
 *
 * 设计要点：
 * - 单个 ciphertext 字段持久化（不分别加密 access / refresh），简化 schema 维护
 * - 复用插件 config key 的 subKey 机制（cloud-sync-architecture.md / CLAUDE.md "插件配置键规范"）：
 *   `auth.config` 顶级 key 已存在，新增 `tokens` subKey，避免污染顶级命名空间
 * - 解密失败（迁移到新 SafeStorage / 数据损坏）时返回 null 而非抛错——
 *   调用方会触发重新登录，比硬抛更友好；同时 log warn 留下诊断线索
 */
export class TokenStorageService extends Disposable implements ITokenStorageService {
  constructor(
    @Inject(ISecretCipherService) private readonly _cipher: ISecretCipherService,
    @Inject(ConfigRepository) private readonly _configRepo: ConfigRepository,
    @Inject(ILogService) private readonly _logService: ILogService
  ) {
    super();
  }

  async save(tokens: ITokenPair): Promise<void> {
    const encrypted = this._cipher.encrypt(JSON.stringify(tokens));
    await this._configRepo.setField(AUTH_PLUGIN_CONFIG_KEY, TOKENS_FIELD, encrypted);
  }

  async load(): Promise<ITokenPair | null> {
    const encrypted = await this._configRepo.getField<string>(AUTH_PLUGIN_CONFIG_KEY, TOKENS_FIELD);
    if (!encrypted) {
      return null;
    }
    try {
      const json = this._cipher.decrypt(encrypted);
      return JSON.parse(json) as ITokenPair;
    } catch (err) {
      this._logService.warn(
        '[TokenStorageService] failed to decrypt persisted tokens; treating as logged out:',
        err
      );
      return null;
    }
  }

  async clear(): Promise<void> {
    await this._configRepo.deleteField(AUTH_PLUGIN_CONFIG_KEY, TOKENS_FIELD);
  }
}
