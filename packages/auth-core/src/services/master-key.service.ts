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
import { base64ToBytes, bytesToBase64, IAuthKeyValueStorage, IPasswordHasher, MASTER_KEY_DERIVATION, MasterKeyState } from '@termlnk/auth';
import { Disposable, ILogService } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';
import { computeArgon2Salt, deriveSubKeys, zeroize } from '../crypto/kdf';

// IAuthKeyValueStorage subKey under AUTH_PLUGIN_CONFIG_KEY. setString/getString is
// already routed through ISecretCipherService (Electron safeStorage on desktop), so the
// blob lands on disk encrypted by the OS keystore.
const WRAPPED_KEY_STORAGE_KEY = 'wrappedMasterKey';

// Serialised form of IMasterKey for at-rest storage. Uint8Array fields are base64-encoded
// since IAuthKeyValueStorage is string-only.
interface IWrappedKeyBlob {
  email: string;
  authKey: string;
  encKey: string;
  indexKey: string;
}

export class MasterKeyService extends Disposable implements IMasterKeyService {
  private readonly _state$ = new BehaviorSubject<MasterKeyState>(MasterKeyState.Locked);
  readonly state$: Observable<MasterKeyState> = this._state$.asObservable();

  private _currentKey: IMasterKey | null = null;

  constructor(
    @ILogService private readonly _logService: ILogService,
    @IPasswordHasher private readonly _passwordHasher: IPasswordHasher,
    @IAuthKeyValueStorage private readonly _storage: IAuthKeyValueStorage
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
      // Persist the wrap *after* publishing Unlocked — a storage hiccup must not block
      // the in-memory flow; the next launch simply falls back to "no auto-restore".
      await this._persistWrappedKey(next);
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

  async tryRestoreFromStorage(): Promise<boolean> {
    let blob: string | null;
    try {
      blob = await this._storage.getString(WRAPPED_KEY_STORAGE_KEY);
    } catch (err) {
      // Storage backend itself is broken (Keychain unavailable, etc.) — degrade silently;
      // user can re-login to recover.
      this._logService.warn('[MasterKeyService] wrapped key read failed:', err);
      return false;
    }
    if (!blob) {
      return false;
    }

    let parsed: IWrappedKeyBlob;
    try {
      parsed = JSON.parse(blob) as IWrappedKeyBlob;
      if (!parsed.email || !parsed.authKey || !parsed.encKey || !parsed.indexKey) {
        throw new Error('wrapped blob missing fields');
      }
    } catch (err) {
      // Corrupt blob: drop it so the next derive() starts clean. Do not re-throw.
      this._logService.warn('[MasterKeyService] wrapped key blob corrupt, discarding:', err);
      await this._safeDeleteWrappedKey();
      return false;
    }

    let restored: IMasterKey;
    try {
      restored = {
        email: parsed.email,
        authKey: base64ToBytes(parsed.authKey),
        encKey: base64ToBytes(parsed.encKey),
        indexKey: base64ToBytes(parsed.indexKey),
      };
    } catch (err) {
      this._logService.warn('[MasterKeyService] wrapped key decode failed, discarding:', err);
      await this._safeDeleteWrappedKey();
      return false;
    }

    // Drop any stale in-memory key first so we never briefly hold two master keys.
    this._zeroizeAndClear();
    this._currentKey = restored;
    this._state$.next(MasterKeyState.Unlocked);
    this._logService.log('[MasterKeyService] master key restored from storage for', restored.email);
    return true;
  }

  async clearPersistedKey(): Promise<void> {
    await this._safeDeleteWrappedKey();
  }

  private async _persistWrappedKey(key: IMasterKey): Promise<void> {
    const blob: IWrappedKeyBlob = {
      email: key.email,
      authKey: bytesToBase64(key.authKey),
      encKey: bytesToBase64(key.encKey),
      indexKey: bytesToBase64(key.indexKey),
    };
    try {
      await this._storage.setString(WRAPPED_KEY_STORAGE_KEY, JSON.stringify(blob));
    } catch (err) {
      // Persistence is best-effort: the user still has a working session in memory; the
      // next restart will require re-login but no data is lost.
      this._logService.warn('[MasterKeyService] wrapped key persist failed:', err);
    }
  }

  private async _safeDeleteWrappedKey(): Promise<void> {
    try {
      await this._storage.deleteKey(WRAPPED_KEY_STORAGE_KEY);
    } catch (err) {
      this._logService.warn('[MasterKeyService] wrapped key delete failed:', err);
    }
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
