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
import { IAuthKeyValueStorage } from '@termlnk/auth';
import { Disposable, ILogService, Inject } from '@termlnk/core';

const TOKENS_KEY = 'tokens';

// Serializes ITokenPair under the `tokens` key. Parsing failures (corruption, schema
// drift) treat the user as logged out instead of crashing.
export class TokenStorageService extends Disposable implements ITokenStorageService {
  constructor(
    @Inject(IAuthKeyValueStorage) private readonly _storage: IAuthKeyValueStorage,
    @Inject(ILogService) private readonly _logService: ILogService
  ) {
    super();
  }

  async save(tokens: ITokenPair): Promise<void> {
    await this._storage.setString(TOKENS_KEY, JSON.stringify(tokens));
  }

  async load(): Promise<ITokenPair | null> {
    const raw = await this._storage.getString(TOKENS_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as ITokenPair;
    } catch (err) {
      this._logService.warn(
        '[TokenStorageService] failed to parse persisted tokens; treating as logged out:',
        err
      );
      return null;
    }
  }

  async clear(): Promise<void> {
    await this._storage.deleteKey(TOKENS_KEY);
  }
}
