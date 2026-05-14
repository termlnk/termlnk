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

import type { IUserAccount, IUserStorageService } from '@termlnk/auth';
import { IAuthKeyValueStorage } from '@termlnk/auth';
import { Disposable, ILogService, Inject } from '@termlnk/core';

const USER_KEY = 'user';

// Serializes IUserAccount as a single JSON blob under the `user` key in whatever
// IAuthKeyValueStorage the host platform binds — desktop/web wrap ConfigRepository +
// SecretCipher; React Native uses expo-secure-store. Parsing failures (corruption,
// schema drift) treat the user as logged out instead of crashing — same fail-soft
// posture as TokenStorageService.
export class UserStorageService extends Disposable implements IUserStorageService {
  constructor(
    @Inject(IAuthKeyValueStorage) private readonly _storage: IAuthKeyValueStorage,
    @Inject(ILogService) private readonly _logService: ILogService
  ) {
    super();
  }

  async save(user: IUserAccount): Promise<void> {
    await this._storage.setString(USER_KEY, JSON.stringify(user));
  }

  async load(): Promise<IUserAccount | null> {
    const raw = await this._storage.getString(USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as IUserAccount;
    } catch (err) {
      this._logService.warn(
        '[UserStorageService] failed to parse persisted user; treating as logged out:',
        err
      );
      return null;
    }
  }

  async clear(): Promise<void> {
    await this._storage.deleteKey(USER_KEY);
  }
}
