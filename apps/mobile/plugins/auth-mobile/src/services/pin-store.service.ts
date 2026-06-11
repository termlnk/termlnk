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

import { base64ToBytes, bytesToBase64, IAuthKeyValueStorage, IPasswordHasher, MASTER_KEY_DERIVATION, randomBytes } from '@termlnk/auth';
import { createIdentifier, Disposable } from '@termlnk/core';

const PIN_STORE_KEY = 'mobile.auth.pin';
const PIN_SALT_BYTES = 16;
const PIN_RECORD_VERSION = 1;
const PIN_DERIVATION = {
  ...MASTER_KEY_DERIVATION,
  outputBytes: 32,
};

export interface IPinStoreService {
  isEnabled(): Promise<boolean>;
  set(pin: string): Promise<void>;
  verify(pin: string): Promise<boolean>;
  clear(): Promise<void>;
}

export const IPinStoreService = createIdentifier<IPinStoreService>('auth-mobile.pin-store.service');

export class PinStoreService extends Disposable implements IPinStoreService {
  private readonly _storage: IAuthKeyValueStorage;
  private readonly _passwordHasher: IPasswordHasher;

  constructor(
    @IAuthKeyValueStorage storage: IAuthKeyValueStorage,
    @IPasswordHasher passwordHasher: IPasswordHasher
  ) {
    super();
    this._storage = storage;
    this._passwordHasher = passwordHasher;
  }

  async isEnabled(): Promise<boolean> {
    return (await this._storage.getString(PIN_STORE_KEY)) !== null;
  }

  async set(pin: string): Promise<void> {
    const salt = randomBytes(PIN_SALT_BYTES);
    const hash = await this._derive(pin, salt);
    await this._storage.setString(PIN_STORE_KEY, this._encodeRecord({
      version: PIN_RECORD_VERSION,
      salt,
      hash,
    }));
  }

  async verify(pin: string): Promise<boolean> {
    const raw = await this._storage.getString(PIN_STORE_KEY);
    if (!raw) {
      return false;
    }

    const record = this._decodeRecord(raw);
    if (!record) {
      return false;
    }

    const candidate = await this._derive(pin, record.salt);
    return constantTimeEqual(candidate, record.hash);
  }

  async clear(): Promise<void> {
    await this._storage.deleteKey(PIN_STORE_KEY);
  }

  private async _derive(pin: string, salt: Uint8Array): Promise<Uint8Array> {
    return this._passwordHasher.argon2id(pin, salt, PIN_DERIVATION);
  }

  private _encodeRecord(record: IPinRecord): string {
    return bytesToBase64(new TextEncoder().encode(JSON.stringify({
      version: record.version,
      salt: bytesToBase64(record.salt),
      hash: bytesToBase64(record.hash),
    })));
  }

  private _decodeRecord(raw: string): IPinRecord | null {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(base64ToBytes(raw))) as Partial<IEncodedPinRecord>;
      if (parsed.version !== PIN_RECORD_VERSION || !parsed.salt || !parsed.hash) {
        return null;
      }
      const salt = base64ToBytes(parsed.salt);
      const hash = base64ToBytes(parsed.hash);
      if (salt.length !== PIN_SALT_BYTES || hash.length !== PIN_DERIVATION.outputBytes) {
        return null;
      }
      return { version: parsed.version, salt, hash };
    } catch {
      return null;
    }
  }
}

interface IEncodedPinRecord {
  readonly version: number;
  readonly salt: string;
  readonly hash: string;
}

interface IPinRecord {
  readonly version: number;
  readonly salt: Uint8Array;
  readonly hash: Uint8Array;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}
