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

import type { ISshKeyEntity } from '../entities';
import type { Database, IDBAdaptorService } from '../services/db-adaptor.service';
import type { ISecretCipherService } from '../services/secret-cipher.service';
import type { IdentityRepository } from './identity';
import { beforeEach, describe, expect, it } from 'vitest';
import { SshKeyRepository } from './ssh-key';

// Columns declared NOT NULL in src/entities/ssh-key.ts; enforced by the fake so
// an unnormalised null payload fails the insert exactly as SQLite would.
const NOT_NULL_COLUMNS = ['id', 'label', 'algorithm', 'privateKey', 'publicKey', 'source'] as const;

function thenable<T>(compute: () => T) {
  return {
    then: (resolve: (value: T) => void, reject: (error: unknown) => void) =>
      Promise.resolve().then(compute).then(resolve, reject),
  };
}

/**
 * In-memory fake mirroring the drizzle execution modes syncUpsertRow uses
 * (same approach as config.test.ts — the workspace better-sqlite3 binary is
 * compiled for Electron and cannot load under Node).
 */
class FakeSshKeyDb {
  readonly rows = new Map<string, Record<string, unknown>>();

  private _assertNotNull(row: Record<string, unknown>): void {
    for (const column of NOT_NULL_COLUMNS) {
      if (row[column] == null) {
        throw new Error(`NOT NULL constraint failed: ssh_key.${column}`);
      }
    }
  }

  select() {
    return {
      from: () => ({
        where: () => ({
          limit: () => thenable(() => [...this.rows.values()]),
        }),
      }),
    };
  }

  insert() {
    return {
      values: (row: Record<string, unknown>) =>
        thenable(() => {
          this._assertNotNull(row);
          this.rows.set(row.id as string, structuredClone(row));
        }),
    };
  }

  update() {
    return {
      set: (row: Record<string, unknown>) => ({
        where: () =>
          thenable(() => {
            this._assertNotNull(row);
            this.rows.set(row.id as string, structuredClone(row));
          }),
      }),
    };
  }
}

function createTestBed() {
  const db = new FakeSshKeyDb();
  const adaptor: IDBAdaptorService = {
    db: db as unknown as Database,
    initialize: async () => {},
    close: async () => {},
  };
  const cipher = {
    scheme: 'local-derived',
    isAvailable: () => true,
    encrypt: (value: string) => value,
    decrypt: (value: string) => value,
  } as unknown as ISecretCipherService;
  // delete() is not exercised here, so the identity cascade dependency can be inert.
  const identityRepo = {} as IdentityRepository;
  return { db, repository: new SshKeyRepository(adaptor, cipher, identityRepo) };
}

describe('SshKeyRepository.syncUpsertRow', () => {
  let db: FakeSshKeyDb;
  let repository: SshKeyRepository;

  beforeEach(() => {
    ({ db, repository } = createTestBed());
  });

  it('coerces null NOT NULL fields from mobile payloads to safe defaults', async () => {
    // Mobile's ssh_keys schema allows null algorithm/privateKey/publicKey/source.
    await repository.syncUpsertRow({
      id: 'key-1',
      label: 'mobile key',
      algorithm: null,
      bits: null,
      privateKey: null,
      publicKey: null,
      certificate: null,
      passphrase: null,
      savePassphrase: false,
      source: null,
      publicKeyFingerprint: null,
      accessedAt: '2026-07-03T00:00:00.000Z',
      createdAt: '2026-07-03T00:00:00.000Z',
      updatedAt: '2026-07-03T00:00:00.000Z',
    } as unknown as ISshKeyEntity);

    const stored = db.rows.get('key-1');
    expect(stored).toBeDefined();
    expect(stored?.algorithm).toBe('ed25519');
    expect(stored?.privateKey).toBe('');
    expect(stored?.publicKey).toBe('');
    expect(stored?.source).toBe('imported');
  });

  it('applies a complete row verbatim', async () => {
    await repository.syncUpsertRow({
      id: 'key-2',
      label: 'desktop key',
      algorithm: 'rsa',
      bits: 4096,
      privateKey: 'PRIVATE',
      publicKey: 'ssh-rsa AAA',
      certificate: null,
      passphrase: null,
      savePassphrase: false,
      source: 'generated',
      publicKeyFingerprint: 'SHA256:abc',
      accessedAt: '2026-07-03T00:00:00.000Z',
      createdAt: '2026-07-03T00:00:00.000Z',
      updatedAt: '2026-07-03T00:00:00.000Z',
    } as ISshKeyEntity);

    const stored = db.rows.get('key-2');
    expect(stored?.algorithm).toBe('rsa');
    expect(stored?.privateKey).toBe('PRIVATE');
    expect(stored?.publicKey).toBe('ssh-rsa AAA');
    expect(stored?.source).toBe('generated');
  });
});
