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

import type { IDaemonKeypairService, IKeypair, IPersistedDaemonKeypair } from '@termlnk/shared-terminal';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { ConfigRepository, ISecretCipherService } from '@termlnk/database';
import { DAEMON_KEYPAIR_CONFIG_SUBKEY, ISharedTerminalCryptoService, SHARED_TERMINAL_PLUGIN_CONFIG_KEY } from '@termlnk/shared-terminal';
import { base64UrlToBytes, bytesToBase64Url } from '../utils/encoding';

/**
 * Owner-side daemon long-term keypair manager.
 *
 * Persistence path: `config[SHARED_TERMINAL_PLUGIN_CONFIG_KEY].daemonKeypair`. The secret key
 * is wrapped by ISecretCipherService (`tmenc1:` prefix) inside that JSON, the public key is
 * stored verbatim. ConfigRepository handles the JSON+upsert; we just plug encryption on top.
 *
 * Concurrency: the first lazy generate is serialised through a single _pending Promise so
 * concurrent callers cannot race two keygens against each other.
 */
export class DaemonKeypairService extends Disposable implements IDaemonKeypairService {
  private _cached: IKeypair | null = null;
  private _pending: Promise<IKeypair> | null = null;

  constructor(
    @Inject(ConfigRepository) private readonly _configRepo: ConfigRepository,
    @ISharedTerminalCryptoService private readonly _cryptoService: ISharedTerminalCryptoService,
    @ISecretCipherService private readonly _cipherService: ISecretCipherService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  async getOrCreate(): Promise<IKeypair> {
    if (this._cached) {
      return this._cached;
    }
    if (this._pending) {
      return this._pending;
    }
    this._pending = this._loadOrGenerate().finally(() => {
      this._pending = null;
    });
    return this._pending;
  }

  async getPublicKey(): Promise<Uint8Array> {
    const kp = await this.getOrCreate();
    return kp.publicKey;
  }

  async rotate(): Promise<IKeypair> {
    const fresh = this._cryptoService.generateKeypair();
    await this._persist(fresh);
    this._cached = fresh;
    this._logService.log('[DaemonKeypairService] rotated daemon keypair; outstanding invites for the old pub are now invalid');
    return fresh;
  }

  private async _loadOrGenerate(): Promise<IKeypair> {
    const stored = await this._configRepo.getField<IPersistedDaemonKeypair>(
      SHARED_TERMINAL_PLUGIN_CONFIG_KEY,
      DAEMON_KEYPAIR_CONFIG_SUBKEY
    );
    if (stored && typeof stored.publicKeyB64 === 'string' && typeof stored.secretKeyCipher === 'string') {
      try {
        const publicKey = base64UrlToBytes(stored.publicKeyB64);
        const secretB64 = this._cipherService.decrypt(stored.secretKeyCipher);
        const secretKey = base64UrlToBytes(secretB64);
        if (publicKey.length === 32 && secretKey.length === 32) {
          this._cached = { publicKey, secretKey };
          return this._cached;
        }
        this._logService.warn('[DaemonKeypairService] persisted keypair has wrong key length; regenerating');
      } catch (err) {
        this._logService.warn('[DaemonKeypairService] persisted keypair could not be decoded; regenerating:', err);
      }
    }
    const fresh = this._cryptoService.generateKeypair();
    await this._persist(fresh);
    this._cached = fresh;
    return fresh;
  }

  private async _persist(keypair: IKeypair): Promise<void> {
    const secretKeyCipher = this._cipherService.encrypt(bytesToBase64Url(keypair.secretKey));
    const persisted: IPersistedDaemonKeypair = {
      publicKeyB64: bytesToBase64Url(keypair.publicKey),
      secretKeyCipher,
      createdAt: Date.now(),
    };
    await this._configRepo.setField(
      SHARED_TERMINAL_PLUGIN_CONFIG_KEY,
      DAEMON_KEYPAIR_CONFIG_SUBKEY,
      persisted
    );
  }
}
