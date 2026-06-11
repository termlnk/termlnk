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

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { Database, IDBAdaptorService } from '../services/db-adaptor.service';
import type { ISecretCipherService, SecretCipherScheme } from '../services/secret-cipher.service';
import { Buffer } from 'node:buffer';
import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as entities from '../entities';
import { SECRET_CIPHER_PREFIX } from '../services/secret-cipher.service';
import { SnippetRepository } from './snippet';

class TestDBAdaptor implements IDBAdaptorService {
  readonly db: Database;

  constructor(private readonly _sqlite: BetterSqlite3.Database) {
    this.db = drizzle({ client: _sqlite, schema: entities }) as BetterSQLite3Database<typeof entities>;
  }

  async initialize(): Promise<void> {}

  async close(): Promise<void> {
    this._sqlite.close();
  }
}

class FakeCipher implements ISecretCipherService {
  readonly scheme: SecretCipherScheme = 'local-derived';

  isAvailable(): boolean {
    return true;
  }

  encrypt(plaintext: string): string {
    return `${SECRET_CIPHER_PREFIX}${Buffer.from(plaintext, 'utf8').toString('base64')}`;
  }

  decrypt(ciphertext: string): string {
    return Buffer.from(ciphertext.slice(SECRET_CIPHER_PREFIX.length), 'base64').toString('utf8');
  }
}

interface ITestBed {
  sqlite: BetterSqlite3.Database;
  repo: SnippetRepository;
}

function createTestBed(): ITestBed {
  const sqlite = new BetterSqlite3(':memory:');
  sqlite.exec(`
    CREATE TABLE snippet (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      command text NOT NULL,
      description text,
      group_id text,
      run_mode text DEFAULT 'insert' NOT NULL,
      accessed_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `);
  return {
    sqlite,
    repo: new SnippetRepository(new TestDBAdaptor(sqlite), new FakeCipher()),
  };
}

describe('SnippetRepository', () => {
  let bed: ITestBed;

  beforeEach(() => {
    bed = createTestBed();
  });

  afterEach(async () => {
    bed.repo.dispose();
    bed.sqlite.close();
  });

  it('creates snippets, encrypts command at rest, and decrypts on read', async () => {
    const id = await bed.repo.create({
      name: 'Deploy',
      command: 'deploy --token inline-secret',
      description: 'prod deploy',
      groupId: null,
    });

    const raw = bed.sqlite.prepare('SELECT command FROM snippet WHERE id = ?').get(id) as { command: string };
    expect(raw.command).toMatch(new RegExp(`^${SECRET_CIPHER_PREFIX}`));
    expect(raw.command).not.toContain('inline-secret');
    await expect(bed.repo.getById(id)).resolves.toMatchObject({
      id,
      command: 'deploy --token inline-secret',
      runMode: 'insert',
    });
  });

  it('updates snippets and emits changed$ events for create/update/delete', async () => {
    const events: Array<{ type: string; id: string }> = [];
    const subscription = bed.repo.changed$.subscribe((event) => events.push(event));
    const id = await bed.repo.create({ name: 'One', command: 'echo 1' });

    await bed.repo.update(id, { name: 'Two', command: 'echo 2' });
    await bed.repo.delete(id);

    expect(events).toEqual([
      { type: 'add', id },
      { type: 'update', id },
      { type: 'delete', id },
    ]);
    await expect(bed.repo.getById(id)).resolves.toBeUndefined();
    subscription.unsubscribe();
  });

  it('syncUpsertRow inserts and updates idempotently while encrypting command', async () => {
    const events: Array<{ type: string; id: string }> = [];
    const subscription = bed.repo.changed$.subscribe((event) => events.push(event));

    await bed.repo.syncUpsertRow({
      id: 's1',
      name: 'Remote',
      command: 'echo remote',
      description: null,
      groupId: null,
      runMode: 'insert',
      accessedAt: '2026-06-01T00:00:00.000Z',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    });
    await bed.repo.syncUpsertRow({
      id: 's1',
      name: 'Remote updated',
      command: 'echo changed',
      description: 'updated',
      groupId: 'g1',
      runMode: 'execute',
      accessedAt: '2026-06-01T00:00:00.000Z',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-02T00:00:00.000Z',
    });

    await expect(bed.repo.getList()).resolves.toHaveLength(1);
    await expect(bed.repo.getById('s1')).resolves.toMatchObject({
      name: 'Remote updated',
      command: 'echo changed',
      groupId: 'g1',
      runMode: 'execute',
    });
    const raw = bed.sqlite.prepare('SELECT command FROM snippet WHERE id = ?').get('s1') as { command: string };
    expect(raw.command).toMatch(new RegExp(`^${SECRET_CIPHER_PREFIX}`));
    expect(events).toEqual([
      { type: 'add', id: 's1' },
      { type: 'update', id: 's1' },
    ]);
    subscription.unsubscribe();
  });
});
