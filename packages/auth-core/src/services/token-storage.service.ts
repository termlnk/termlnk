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

// Persists the ITokenPair as a single SecretCipher-encrypted JSON blob under the
// `auth.config.tokens` subKey. Storing one ciphertext (not separate access/refresh fields)
// keeps the schema flat. Decrypt failures (cipher rotation, corruption) treat the user as
// logged out and surface a warning — better UX than crashing on stale ciphertext.
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
