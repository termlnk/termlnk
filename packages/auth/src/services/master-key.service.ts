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

import type { Observable } from 'rxjs';
import type { IDerivationMaterial, IMasterKey, MasterKeyState } from '../models/master-key';
import { createIdentifier } from '@termlnk/core';

/**
 * Master Key 派生与生命周期管理（**仅主进程**）。
 *
 * 设计要点：
 * - 主密钥不持久化——每次启动需用户重新登录派生
 * - 通过 lock() 主动清除内存中的密钥（用户主动登出 / 长时间不活跃）
 * - 派生纯客户端：邮箱 + 服务端发的随机 salt → Argon2id → HKDF 三把子密钥
 *
 * 消费者：
 * - SyncCryptoService（@termlnk/sync-core）拿 encKey 加解密同步 payload
 * - AuthService 拿 authKey 派生 SRP6a verifier 或 JWT auth hash
 * - 备份导出/导入功能拿 encKey 加密整库 zip
 */
export interface IMasterKeyService {
  /** 当前状态（locked / unlocked） */
  readonly state$: Observable<MasterKeyState>;

  /**
   * 用主密码派生 master key 并保存到内存。
   * @param password 用户主密码（瞬时使用；本方法返回前不应被持久化或转交其他模块）
   * @param material salt 等派生材料（来自服务端登录响应）
   */
  derive(password: string, material: IDerivationMaterial): Promise<IMasterKey>;

  /** 锁定：清除内存中的 master key */
  lock(): void;

  /** 获取当前 master key；locked 状态返回 null */
  getCurrent(): IMasterKey | null;

  /** 同步获取当前状态 */
  getState(): MasterKeyState;
}

export const IMasterKeyService = createIdentifier<IMasterKeyService>('auth.master-key-service');
