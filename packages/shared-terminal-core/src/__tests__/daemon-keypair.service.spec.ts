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

import type { ILogService, LogLevel } from '@termlnk/core';
import type { ConfigRepository, ISecretCipherService } from '@termlnk/database';
import { DAEMON_KEYPAIR_CONFIG_SUBKEY, SHARED_TERMINAL_PLUGIN_CONFIG_KEY } from '@termlnk/shared-terminal';
import { describe, expect, it } from 'vitest';
import { SharedTerminalCryptoService } from '../services/crypto.service';
import { DaemonKeypairService } from '../services/daemon-keypair.service';

class FakeConfigRepository {
  store = new Map<string, Record<string, unknown>>();

  async getField<T = unknown>(key: string, field: string): Promise<T | null> {
    const obj = this.store.get(key);
    return (obj?.[field] ?? null) as T | null;
  }

  async setField(key: string, field: string, value: unknown): Promise<void> {
    const obj = this.store.get(key) ?? {};
    obj[field] = value;
    this.store.set(key, obj);
  }
}

/** Reversible cipher with the `tmenc1:` envelope so the service's roundtrip works. */
class FakeCipher implements ISecretCipherService {
  readonly scheme = 'local-derived' as const;
  isAvailable(): boolean {
    return true;
  }
  encrypt(plaintext: string): string {
    if (plaintext === '' || plaintext.startsWith('tmenc1:')) {
      return plaintext;
    }
    return `tmenc1:${plaintext}`;
  }
  decrypt(ciphertext: string): string {
    return ciphertext.startsWith('tmenc1:') ? ciphertext.slice('tmenc1:'.length) : ciphertext;
  }
}

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

function makeService(repo: FakeConfigRepository = new FakeConfigRepository()): {
  service: DaemonKeypairService;
  repo: FakeConfigRepository;
  cipher: FakeCipher;
} {
  const cipher = new FakeCipher();
  const service = new DaemonKeypairService(
    repo as unknown as ConfigRepository,
    new SharedTerminalCryptoService(),
    cipher,
    new NoopLogService()
  );
  return { service, repo, cipher };
}

describe('DaemonKeypairService', () => {
  it('generates and persists a keypair on first call', async () => {
    const { service, repo } = makeService();
    const kp = await service.getOrCreate();
    expect(kp.publicKey.length).toBe(32);
    expect(kp.secretKey.length).toBe(32);

    const persisted = await repo.getField<{ publicKeyB64: string; secretKeyCipher: string }>(
      SHARED_TERMINAL_PLUGIN_CONFIG_KEY,
      DAEMON_KEYPAIR_CONFIG_SUBKEY
    );
    expect(persisted?.publicKeyB64).toBeDefined();
    expect(persisted?.secretKeyCipher.startsWith('tmenc1:')).toBe(true);
  });

  it('reuses the persisted keypair across instances', async () => {
    const repo = new FakeConfigRepository();
    const first = makeService(repo);
    const a = await first.service.getOrCreate();

    const second = makeService(repo);
    const b = await second.service.getOrCreate();

    expect(Array.from(b.publicKey)).toEqual(Array.from(a.publicKey));
    expect(Array.from(b.secretKey)).toEqual(Array.from(a.secretKey));
  });

  it('caches the result and returns the same instance on subsequent calls', async () => {
    const { service } = makeService();
    const a = await service.getOrCreate();
    const b = await service.getOrCreate();
    expect(b).toBe(a);
  });

  it('serialises concurrent first-time calls into a single keygen', async () => {
    const { service } = makeService();
    const [a, b, c] = await Promise.all([
      service.getOrCreate(),
      service.getOrCreate(),
      service.getOrCreate(),
    ]);
    expect(Array.from(a.publicKey)).toEqual(Array.from(b.publicKey));
    expect(Array.from(a.publicKey)).toEqual(Array.from(c.publicKey));
  });

  it('rotate() replaces the persisted keypair and the cache', async () => {
    const { service } = makeService();
    const old = await service.getOrCreate();
    const fresh = await service.rotate();
    expect(Array.from(fresh.publicKey)).not.toEqual(Array.from(old.publicKey));

    const reread = await service.getOrCreate();
    expect(Array.from(reread.publicKey)).toEqual(Array.from(fresh.publicKey));
  });

  it('regenerates when persisted data fails decoding', async () => {
    const repo = new FakeConfigRepository();
    await repo.setField(SHARED_TERMINAL_PLUGIN_CONFIG_KEY, DAEMON_KEYPAIR_CONFIG_SUBKEY, {
      publicKeyB64: 'invalid-too-short',
      secretKeyCipher: 'tmenc1:not-base64url-len',
      createdAt: 0,
    });
    const { service } = makeService(repo);
    const kp = await service.getOrCreate();
    expect(kp.publicKey.length).toBe(32);
    expect(kp.secretKey.length).toBe(32);
  });

  it('getPublicKey returns just the public half', async () => {
    const { service } = makeService();
    const pub = await service.getPublicKey();
    const full = await service.getOrCreate();
    expect(Array.from(pub)).toEqual(Array.from(full.publicKey));
  });
});
