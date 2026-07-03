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

import type { Database, IDBAdaptorService } from '../services/db-adaptor.service';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConfigRepository } from './config';

interface IFakeConfigRow {
  key: string;
  value: unknown;
  accessedAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Extracts the bound value from a drizzle `eq(column, value)` condition.
 * The condition is an SQL object whose queryChunks contain a Param
 * carrying the value alongside its encoder.
 */
function extractEqValue(condition: unknown): string {
  const chunks = (condition as { queryChunks?: unknown[] }).queryChunks ?? [];
  for (const chunk of chunks) {
    if (chunk && typeof chunk === 'object' && 'value' in chunk && 'encoder' in chunk) {
      return (chunk as { value: string }).value;
    }
  }
  throw new Error('[FakeConfigDb] eq() param not found');
}

/**
 * In-memory fake mirroring the two drizzle execution modes ConfigRepository
 * relies on. The workspace better-sqlite3 binary is compiled for Electron and
 * cannot load under Node, so real SQL semantics stay Drizzle's responsibility
 * (same approach as pairing.service.spec.ts).
 *
 * - Awaited queries resolve on a microtask, like drizzle's thenable queries.
 *   This is what made the original read-modify-write interleave and lose
 *   sibling fields.
 * - `transaction(cb)` runs synchronously and exposes `.all()` / `.run()`,
 *   matching the better-sqlite3 sync transaction the fix depends on.
 */
class FakeConfigDb {
  readonly rows = new Map<string, IFakeConfigRow>();

  select() {
    return {
      from: () => ({
        where: (condition: unknown) => {
          const key = extractEqValue(condition);
          const read = () => {
            const row = this.rows.get(key);
            return row ? [structuredClone(row)] : [];
          };
          return {
            limit: () => ({
              all: () => read(),
              then: (resolve: (rows: IFakeConfigRow[]) => void, reject: (error: unknown) => void) =>
                Promise.resolve().then(read).then(resolve, reject),
            }),
          };
        },
      }),
    };
  }

  insert() {
    return {
      values: (row: { key: string; value: unknown; updatedAt: string }) => ({
        onConflictDoUpdate: () => {
          const upsert = () => {
            const existing = this.rows.get(row.key);
            this.rows.set(row.key, {
              key: row.key,
              value: structuredClone(row.value),
              accessedAt: existing?.accessedAt ?? row.updatedAt,
              createdAt: existing?.createdAt ?? row.updatedAt,
              updatedAt: row.updatedAt,
            });
          };
          return {
            run: () => upsert(),
            then: (resolve: (value: void) => void, reject: (error: unknown) => void) =>
              Promise.resolve().then(upsert).then(resolve, reject),
          };
        },
      }),
    };
  }

  transaction<T>(callback: (tx: this) => T): T {
    return callback(this);
  }
}

function createTestBed() {
  const db = new FakeConfigDb();
  const adaptor: IDBAdaptorService = {
    db: db as unknown as Database,
    initialize: async () => {},
    close: async () => {},
  };
  return { repository: new ConfigRepository(adaptor) };
}

describe('ConfigRepository field operations', () => {
  let repository: ConfigRepository;

  beforeEach(() => {
    ({ repository } = createTestBed());
  });

  it('sets and reads back a single field', async () => {
    await repository.setField('auth.config', 'tokens', { access: 'a' });
    expect(await repository.getField('auth.config', 'tokens')).toEqual({ access: 'a' });
  });

  it('does not lose sibling fields when different sub-keys are written concurrently', async () => {
    // Fire all writers without awaiting in between: the old read-modify-write
    // implementation read a stale row snapshot and rolled back sibling fields.
    await Promise.all([
      repository.setField('auth.config', 'tokens', { access: 'a' }),
      repository.setField('auth.config', 'wrappedMasterKey', 'wmk'),
      repository.setField('auth.config', 'account', { email: 'a@b.c' }),
      repository.setField('auth.config', 'kcv', 'kcv-value'),
    ]);

    expect(await repository.get('auth.config')).toEqual({
      tokens: { access: 'a' },
      wrappedMasterKey: 'wmk',
      account: { email: 'a@b.c' },
      kcv: 'kcv-value',
    });
  });

  it('does not lose sibling fields when deleteField runs concurrently with setField', async () => {
    await repository.setField('auth.config', 'stale', 'to-remove');

    await Promise.all([
      repository.deleteField('auth.config', 'stale'),
      repository.setField('auth.config', 'tokens', { access: 'a' }),
    ]);

    expect(await repository.get('auth.config')).toEqual({
      tokens: { access: 'a' },
    });
  });

  it('deleteField on a missing row is a no-op and emits no change event', async () => {
    const events: unknown[] = [];
    repository.changed$.subscribe((event) => events.push(event));

    await repository.deleteField('missing.config', 'field');

    expect(await repository.get('missing.config')).toBeNull();
    expect(events).toEqual([]);
  });

  it('emits change events with the sub-key for field writes', async () => {
    const events: unknown[] = [];
    repository.changed$.subscribe((event) => events.push(event));

    await repository.setField('auth.config', 'tokens', 't');
    await repository.deleteField('auth.config', 'tokens');

    expect(events).toEqual([
      { type: 'set', key: 'auth.config', subKey: 'tokens' },
      { type: 'delete', key: 'auth.config', subKey: 'tokens' },
    ]);
  });
});
