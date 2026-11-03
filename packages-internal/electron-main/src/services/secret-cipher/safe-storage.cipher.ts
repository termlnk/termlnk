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

import type { ILogService, Nullable } from '@termlnk/core';
import type { ISecretCipherService, SecretCipherScheme } from '@termlnk/database';
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import process from 'node:process';
import { AesGcmSecretCipher, isEncrypted, LEGACY_SAFE_STORAGE_SCHEME, LocalDerivedSecretCipher, tryDecodeSecretPayload } from '@termlnk/database';
import { safeStorage } from 'electron';

const DEK_BYTES = 32;

export interface ISafeStorageCipherOptions {
  // Where the keystore-wrapped data key (DEK) lives.
  keyFilePath: string;
  logService: ILogService;
}

// Envelope cipher: fields are AES-256-GCM encrypted with a random DEK, and only the DEK is
// wrapped by the OS keystore (Keychain / DPAPI / libsecret) through the async safeStorage API.
// The sync safeStorage API is removed in Electron 46, and ISecretCipherService must stay sync.
//
// Falls back to LocalDerivedSecretCipher for new writes when the keystore (or the wrapped DEK)
// is unusable. The fallback also decrypts rows written under the local-derived scheme, so users
// can move between environments without losing access to existing data.
export class SafeStorageCipher implements ISecretCipherService {
  private readonly _fallback = new LocalDerivedSecretCipher();
  private readonly _warned = new Set<string>();

  constructor(
    private readonly _envelope: Nullable<AesGcmSecretCipher>,
    private readonly _logService: ILogService
  ) {}

  get scheme(): SecretCipherScheme {
    return this._envelope ? 'safe-storage-envelope' : 'local-derived';
  }

  // TEMPORARY: used only by the legacy safe-storage migration.
  get canRewrapLegacy(): boolean {
    return this._envelope !== null;
  }

  encrypt(plaintext: string): string {
    return (this._envelope ?? this._fallback).encrypt(plaintext);
  }

  decrypt(ciphertext: string): string {
    if (!isEncrypted(ciphertext)) {
      return ciphertext;
    }

    const payload = tryDecodeSecretPayload(ciphertext);
    if (!payload) {
      throw new Error('[SafeStorageCipher] Malformed payload');
    }

    // Route by the payload's own scheme so cross-scheme reads keep working.
    switch (payload.scheme) {
      case 'local-derived':
        return this._fallback.decrypt(ciphertext);
      case 'safe-storage-envelope':
        if (!this._envelope) {
          // Return '' instead of throwing so the secret sanitizer does not wipe a value that
          // becomes readable again once the keystore / DEK is restored.
          this._warnOnce(payload.scheme, '[SafeStorageCipher] Cannot decrypt envelope ciphertext: data key unavailable in current session');
          return '';
        }
        return this._envelope.decrypt(ciphertext);
      case LEGACY_SAFE_STORAGE_SCHEME:
        // TEMPORARY: only reachable when the legacy migration failed for this value; it is
        // retried next launch, so keep the stored payload and just yield no secret.
        this._warnOnce(payload.scheme, '[SafeStorageCipher] Legacy safe-storage ciphertext not migrated yet; treating as empty');
        return '';
      default:
        throw new Error(`[SafeStorageCipher] Unknown scheme '${payload.scheme}'`);
    }
  }

  // TEMPORARY: re-wrap one legacy per-field `safe-storage` token into the envelope scheme.
  // Returns null when the token cannot be migrated now (retried next launch).
  async rewrapLegacyToken(legacyToken: string): Promise<string | null> {
    const payload = tryDecodeSecretPayload(legacyToken);
    if (!this._envelope || payload?.scheme !== LEGACY_SAFE_STORAGE_SCHEME) {
      return null;
    }

    const { result } = await safeStorage.decryptStringAsync(Buffer.from(payload.ciphertext, 'base64'));
    if (result === '') {
      return null;
    }
    return this._envelope.encrypt(result);
  }

  private _warnOnce(key: string, message: string): void {
    if (!this._warned.has(key)) {
      this._warned.add(key);
      this._logService.error(message);
    }
  }
}

export async function createSafeStorageCipher(options: ISafeStorageCipherOptions): Promise<SafeStorageCipher> {
  const { keyFilePath, logService } = options;

  if (!(await safeStorage.isAsyncEncryptionAvailable())) {
    logService.warn(
      '[SafeStorageCipher] OS keystore unavailable; falling back to LocalDerivedSecretCipher. '
      + 'Install gnome-keyring (GNOME) or kwallet (KDE) on Linux for stronger protection.'
    );
    return new SafeStorageCipher(null, logService);
  }

  const dek = await _loadOrCreateDek(keyFilePath, logService);
  return new SafeStorageCipher(dek ? new AesGcmSecretCipher('safe-storage-envelope', dek) : null, logService);
}

// Returns null when the DEK cannot be used. An existing key file is never regenerated or
// overwritten on failure: it may become unwrappable again (keystore unlocked / restored),
// and replacing it would make the loss of every envelope-encrypted value permanent.
async function _loadOrCreateDek(keyFilePath: string, logService: ILogService): Promise<Nullable<Buffer>> {
  let wrapped: Buffer;
  try {
    wrapped = await readFile(keyFilePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logService.error('[SafeStorageCipher] Failed to read wrapped data key; falling back to LocalDerivedSecretCipher:', error);
      return null;
    }
    return _createDek(keyFilePath, logService);
  }

  try {
    const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(wrapped);
    const dek = Buffer.from(result, 'base64');
    if (dek.length !== DEK_BYTES) {
      throw new Error(`Unexpected data key length ${dek.length}`);
    }

    if (shouldReEncrypt) {
      try {
        await _writeKeyFile(keyFilePath, await safeStorage.encryptStringAsync(result));
      } catch (error) {
        // The old wrapping still decrypts; retry on the next launch.
        logService.warn('[SafeStorageCipher] Failed to re-wrap data key:', error);
      }
    }
    return dek;
  } catch (error) {
    logService.error(
      '[SafeStorageCipher] Failed to unwrap data key; keeping the key file untouched and falling back to LocalDerivedSecretCipher:',
      error
    );
    return null;
  }
}

async function _createDek(keyFilePath: string, logService: ILogService): Promise<Nullable<Buffer>> {
  try {
    const dek = randomBytes(DEK_BYTES);
    await _writeKeyFile(keyFilePath, await safeStorage.encryptStringAsync(dek.toString('base64')));
    return dek;
  } catch (error) {
    // A DEK that was never persisted would orphan everything encrypted with it.
    logService.error('[SafeStorageCipher] Failed to persist data key; falling back to LocalDerivedSecretCipher:', error);
    return null;
  }
}

// Temp file + rename so a crash never leaves a truncated key file.
async function _writeKeyFile(keyFilePath: string, wrapped: Buffer): Promise<void> {
  await mkdir(dirname(keyFilePath), { recursive: true });
  const tempPath = `${keyFilePath}.${process.pid}.tmp`;
  try {
    await writeFile(tempPath, wrapped, { mode: 0o600 });
    // writeFile's mode only applies on creation; a stale temp file could carry wider bits.
    await chmod(tempPath, 0o600);
    await rename(tempPath, keyFilePath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}
