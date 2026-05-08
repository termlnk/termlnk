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

import type { ITokenPair } from '@termlnk/auth';
import type { ILogService, LogLevel } from '@termlnk/core';
import type { ConfigRepository, ISecretCipherService } from '@termlnk/database';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TokenStorageService } from '../services/token-storage.service';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

class FakeSecretCipher {
  encrypt(plaintext: string): string {
    return `ENC(${plaintext})`;
  }

  decrypt(ciphertext: string): string {
    if (!ciphertext.startsWith('ENC(') || !ciphertext.endsWith(')')) {
      throw new Error('FakeSecretCipher: corrupted ciphertext');
    }
    return ciphertext.slice(4, -1);
  }
}

class FakeConfigRepository {
  store: Map<string, Map<string, unknown>> = new Map();

  async getField<T>(key: string, field: string): Promise<T | null> {
    const obj = this.store.get(key);
    return (obj?.get(field) ?? null) as T | null;
  }

  async setField(key: string, field: string, value: unknown): Promise<void> {
    if (!this.store.has(key)) {
      this.store.set(key, new Map());
    }
    this.store.get(key)!.set(field, value);
  }

  async deleteField(key: string, field: string): Promise<void> {
    this.store.get(key)?.delete(field);
  }
}

const SAMPLE_TOKENS: ITokenPair = {
  accessToken: 'access.jwt.token',
  refreshToken: 'refresh.jwt.token',
  accessTokenExpiresAt: 1_700_000_000_000 + 15 * 60 * 1000,
  refreshTokenExpiresAt: 1_700_000_000_000 + 30 * 24 * 60 * 60 * 1000,
};

describe('TokenStorageService', () => {
  let cipher: FakeSecretCipher;
  let configRepo: FakeConfigRepository;
  let service: TokenStorageService;

  beforeEach(() => {
    cipher = new FakeSecretCipher();
    configRepo = new FakeConfigRepository();
    service = new TokenStorageService(
      cipher as unknown as ISecretCipherService,
      configRepo as unknown as ConfigRepository,
      new NoopLogService()
    );
  });

  afterEach(() => {
    service.dispose();
  });

  it('load returns null when nothing has been saved', async () => {
    expect(await service.load()).toBeNull();
  });

  it('save then load round-trips ITokenPair through the cipher', async () => {
    await service.save(SAMPLE_TOKENS);
    const loaded = await service.load();
    expect(loaded).toEqual(SAMPLE_TOKENS);
  });

  it('persists the cipher output (not the raw ITokenPair) under auth.config.tokens', async () => {
    await service.save(SAMPLE_TOKENS);
    const stored = configRepo.store.get('auth.config')!.get('tokens') as string;
    // Stored value must have gone through the cipher; with the real
    // SecretCipher this is opaque ciphertext, here we just verify the
    // cipher pipeline ran (FakeSecretCipher prefixes with `ENC(`).
    expect(stored).toMatch(/^ENC\(/);
    expect(typeof stored).toBe('string');
  });

  it('clear removes the persisted field; subsequent load returns null', async () => {
    await service.save(SAMPLE_TOKENS);
    await service.clear();
    expect(await service.load()).toBeNull();
  });

  it('save overwrites prior tokens', async () => {
    await service.save(SAMPLE_TOKENS);
    const updated: ITokenPair = { ...SAMPLE_TOKENS, accessToken: 'rotated.access' };
    await service.save(updated);
    const loaded = await service.load();
    expect(loaded?.accessToken).toBe('rotated.access');
  });

  it('returns null (not throws) when ciphertext cannot be decrypted', async () => {
    // Simulate stale ciphertext from a different SafeStorage key (decrypt throws)
    await configRepo.setField('auth.config', 'tokens', 'CORRUPT_NOT_VALID_CIPHER');
    expect(await service.load()).toBeNull();
  });
});
