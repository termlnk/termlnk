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

import type { IDerivationMaterial, IMasterKey, IMasterKeyService, IPasswordHasher } from '@termlnk/auth';
import type { Observable } from 'rxjs';
import { IPasswordHasher as IPasswordHasherId, MASTER_KEY_DERIVATION, MasterKeyState } from '@termlnk/auth';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';
import { computeArgon2Salt, deriveSubKeys, zeroize } from '../crypto/kdf';

export class MasterKeyService extends Disposable implements IMasterKeyService {
  private readonly _state$ = new BehaviorSubject<MasterKeyState>(MasterKeyState.Locked);
  readonly state$: Observable<MasterKeyState> = this._state$.asObservable();

  private _currentKey: IMasterKey | null = null;

  constructor(
    @Inject(ILogService) private readonly _logService: ILogService,
    @Inject(IPasswordHasherId) private readonly _passwordHasher: IPasswordHasher
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

    // Drop any prior key first so we do not briefly hold two master keys.
    this._zeroizeAndClear();

    const salt = computeArgon2Salt(material.email, material.saltB64);
    const masterKey = await this._passwordHasher.argon2id(password, salt, MASTER_KEY_DERIVATION);
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
      // The HKDF inputs above already consumed the master key; nothing else needs it.
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
