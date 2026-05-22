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

import type { IAuthKeyValueStorage } from '@termlnk/auth';
import { AUTH_PLUGIN_CONFIG_KEY } from '@termlnk/auth';
import { Inject } from '@termlnk/core';
import { ConfigRepository } from '../repositories/config';
import { ISecretCipherService } from './secret-cipher.service';

// Bridges IAuthKeyValueStorage onto ConfigRepository + ISecretCipherService for the
// Electron main / web server processes. Values are wrapped in the secret-cipher prefix
// before they land in SQLite, so disk inspection sees ciphertext only. Mobile binds a
// SecureStore-backed adapter instead and never instantiates this class.
//
// Storage layout: AUTH_PLUGIN_CONFIG_KEY (`auth.config`) row → JSON value blob, the
// `key` parameter becomes the JSON subKey under that row. Reusing the existing config
// row keeps `setField` cheap (single UPSERT) and stays inside the
// plugin-config-key-one-per-plugin rule.
export class ConfigRepoAuthKeyValueStorage implements IAuthKeyValueStorage {
  constructor(
    @Inject(ConfigRepository) private readonly _configRepo: ConfigRepository,
    @ISecretCipherService private readonly _cipher: ISecretCipherService
  ) {}

  async getString(key: string): Promise<string | null> {
    const encrypted = await this._configRepo.getField<string>(AUTH_PLUGIN_CONFIG_KEY, key);
    if (!encrypted) {
      return null;
    }
    return this._cipher.decrypt(encrypted);
  }

  async setString(key: string, value: string): Promise<void> {
    const encrypted = this._cipher.encrypt(value);
    await this._configRepo.setField(AUTH_PLUGIN_CONFIG_KEY, key, encrypted);
  }

  async deleteKey(key: string): Promise<void> {
    await this._configRepo.deleteField(AUTH_PLUGIN_CONFIG_KEY, key);
  }
}
