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

import type { ITokenPair } from '../models/session';
import { createIdentifier } from '@termlnk/core';

/**
 * Token 持久化抽象。
 *
 * 实现需保证 token 在磁盘上是密文：
 * - 主进程实现复用 @termlnk/database 的 ISecretCipherService（OS keystore 加密）
 * - 测试实现可用纯内存 Map
 *
 * 仅主进程使用——access/refresh token 永不跨 IPC。
 */
export interface ITokenStorageService {
  /** 保存 token 对（覆盖式） */
  save(tokens: ITokenPair): Promise<void>;
  /** 加载 token 对；不存在返回 null */
  load(): Promise<ITokenPair | null>;
  /** 清空（登出时调用） */
  clear(): Promise<void>;
}

export const ITokenStorageService = createIdentifier<ITokenStorageService>('auth.token-storage-service');
