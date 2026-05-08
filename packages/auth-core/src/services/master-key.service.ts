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

import type { IDerivationMaterial, IMasterKey, IMasterKeyService } from '@termlnk/auth';
import type { Observable } from 'rxjs';
import { MasterKeyState } from '@termlnk/auth';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';
import { computeArgon2Salt, deriveMasterKey, deriveSubKeys, zeroize } from '../crypto/kdf';

/**
 * MasterKeyService 实现：仅主进程内生命周期，永不落盘、永不跨 IPC。
 *
 * 状态机：
 * - Locked（初始）：内存中无 master key；任何 getCurrent() 返回 null
 * - Unlocked：derive() 成功后进入；调用 lock() 或 dispose() 退出
 *
 * 派生流程：password + (email, saltB64) → Argon2id → HKDF 三把子密钥
 */
export class MasterKeyService extends Disposable implements IMasterKeyService {
  private readonly _state$ = new BehaviorSubject<MasterKeyState>(MasterKeyState.Locked);
  readonly state$: Observable<MasterKeyState> = this._state$.asObservable();

  private _currentKey: IMasterKey | null = null;

  constructor(
    @Inject(ILogService) private readonly _logService: ILogService
  ) {
    super();
  }

  override dispose(): void {
    this._zeroizeAndClear();
    this._state$.complete();
    super.dispose();
  }

  async derive(password: string, material: IDerivationMaterial): Promise<IMasterKey> {
    if (!password) {
      throw new Error('[MasterKeyService] password must be a non-empty string');
    }
    if (!material?.email || !material?.saltB64) {
      throw new Error('[MasterKeyService] derivation material requires both email and saltB64');
    }

    // 派生过程中先清掉旧 key，避免短时间内同时持有两份 master key
    this._zeroizeAndClear();

    const salt = computeArgon2Salt(material.email, material.saltB64);
    const masterKey = await deriveMasterKey(password, salt);
    try {
      const subKeys = deriveSubKeys(masterKey);
      const next: IMasterKey = {
        authKey: subKeys.authKey,
        encKey: subKeys.encKey,
        indexKey: subKeys.indexKey,
        email: material.email,
      };
      this._currentKey = next;
      this._state$.next(MasterKeyState.Unlocked);
      this._logService.log('[MasterKeyService] master key derived for', material.email);
      return next;
    } finally {
      // master key 本身已经被 HKDF 派生使用过，从这里开始不再需要——清掉
      zeroize(masterKey);
    }
  }

  lock(): void {
    if (this._currentKey === null) {
      return;
    }
    this._zeroizeAndClear();
    this._state$.next(MasterKeyState.Locked);
    this._logService.log('[MasterKeyService] locked');
  }

  getCurrent(): IMasterKey | null {
    return this._currentKey;
  }

  getState(): MasterKeyState {
    return this._state$.getValue();
  }

  private _zeroizeAndClear(): void {
    if (this._currentKey === null) {
      return;
    }
    zeroize(this._currentKey.authKey);
    zeroize(this._currentKey.encKey);
    zeroize(this._currentKey.indexKey);
    this._currentKey = null;
  }
}
