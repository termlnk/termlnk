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

import type { IArgon2idParams, IAuthKeyValueStorage, IPasswordHasher } from '@termlnk/auth';
import { beforeEach, describe, expect, it } from 'vitest';
import { PinStoreService } from '../pin-store.service';

class MemoryAuthKeyValueStorage implements IAuthKeyValueStorage {
  private readonly _values = new Map<string, string>();

  async getString(key: string): Promise<string | null> {
    return this._values.get(key) ?? null;
  }

  async setString(key: string, value: string): Promise<void> {
    this._values.set(key, value);
  }

  async deleteKey(key: string): Promise<void> {
    this._values.delete(key);
  }
}

class DeterministicPasswordHasher implements IPasswordHasher {
  async argon2id(password: string, salt: Uint8Array, params: IArgon2idParams): Promise<Uint8Array> {
    const encoded = new TextEncoder().encode(`${password}:${Array.from(salt).join(',')}:${params.iterations}`);
    const out = new Uint8Array(params.outputBytes);
    for (let i = 0; i < out.length; i++) {
      out[i] = encoded[i % encoded.length] ?? 0;
    }
    return out;
  }
}

describe('PinStoreService', () => {
  let storage: MemoryAuthKeyValueStorage;
  let service: PinStoreService;

  beforeEach(() => {
    storage = new MemoryAuthKeyValueStorage();
    service = new PinStoreService(storage, new DeterministicPasswordHasher());
  });

  it('enables pin storage after set', async () => {
    await service.set('123456');

    await expect(service.isEnabled()).resolves.toBe(true);
  });

  it('verifies the correct pin and rejects a wrong pin', async () => {
    await service.set('123456');

    await expect(service.verify('123456')).resolves.toBe(true);
    await expect(service.verify('654321')).resolves.toBe(false);
  });

  it('clears the stored pin', async () => {
    await service.set('123456');
    await service.clear();

    await expect(service.isEnabled()).resolves.toBe(false);
    await expect(service.verify('123456')).resolves.toBe(false);
  });
});
