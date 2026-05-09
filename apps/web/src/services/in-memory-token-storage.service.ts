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

/**
 * 浏览器端 ITokenStorageService 实现——in-memory only。
 *
 * 设计依据：cloud-sync-architecture.md §3.3——Web 端永不持久化解密 vault。
 * Tokens 同样只活在当前页面 tab 周期内：刷新或关闭页面后即销毁，
 * 用户须重新登录。这个权衡换取的是 XSS 攻击下凭据曝光面最小化。
 *
 * 桌面端的 TokenStorageService 走 OS keystore + ConfigRepository 持久化路径，
 * 不复用本类。
 */
export class InMemoryTokenStorageService implements ITokenStorageService {
  private _tokens: ITokenPair | null = null;

  async save(tokens: ITokenPair): Promise<void> {
    this._tokens = tokens;
  }

  async load(): Promise<ITokenPair | null> {
    return this._tokens;
  }

  async clear(): Promise<void> {
    this._tokens = null;
  }
}
