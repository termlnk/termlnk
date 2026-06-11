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

import type { ISyncEntityRow } from '@termlnk/sync';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { DatabaseMobile, IDatabaseMobileAdaptorService } from '../database-mobile-adaptor.service';
import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { firstValueFrom, skip, take } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as entities from '../../entities';
import { MobileSnippetRepository } from '../mobile-snippet-repository';

class TestDatabaseMobileAdaptor implements IDatabaseMobileAdaptorService {
  private readonly _db: BetterSQLite3Database<typeof entities>;

  constructor(private readonly _sqlite: BetterSqlite3.Database) {
    this._db = drizzle({ client: _sqlite, schema: entities }) as BetterSQLite3Database<typeof entities>;
  }

  async ready(): Promise<DatabaseMobile> {
    return this._db as unknown as DatabaseMobile;
  }

  async close(): Promise<void> {
    this._sqlite.close();
  }
}

interface ITestBed {
  readonly sqlite: BetterSqlite3.Database;
  readonly repo: MobileSnippetRepository;
}

function createTestBed(): ITestBed {
  const sqlite = new BetterSqlite3(':memory:');
  sqlite.exec(`
    CREATE TABLE snippets (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      command text NOT NULL,
      description text,
      group_id text,
      run_mode text DEFAULT 'insert' NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `);

  return {
    sqlite,
    repo: new MobileSnippetRepository(new TestDatabaseMobileAdaptor(sqlite)),
  };
}

describe('MobileSnippetRepository', () => {
  let bed: ITestBed;

  beforeEach(() => {
    bed = createTestBed();
  });

  afterEach(() => {
    bed.repo.dispose();
    bed.sqlite.close();
  });

  it('updates snippets$ after create, update, and delete', async () => {
    await bed.repo.ready();

    const createEmission = firstValueFrom(bed.repo.snippets$.pipe(skip(1), take(1)));
    const id = await bed.repo.createSnippet({
      name: 'Deploy',
      command: 'pnpm deploy',
      description: 'prod',
      groupId: null,
      runMode: 'insert',
    });
    await expect(createEmission).resolves.toMatchObject([{ id, name: 'Deploy' }]);

    const updateEmission = firstValueFrom(bed.repo.snippets$.pipe(skip(1), take(1)));
    await bed.repo.updateSnippet({
      id,
      name: 'Deploy prod',
      command: 'pnpm deploy --prod',
      description: null,
      groupId: 'ops',
      runMode: 'insert-run',
    });
    await expect(updateEmission).resolves.toMatchObject([{ id, name: 'Deploy prod', groupId: 'ops', runMode: 'insert-run' }]);

    const deleteEmission = firstValueFrom(bed.repo.snippets$.pipe(skip(1), take(1)));
    await bed.repo.deleteSnippet(id);
    await expect(deleteEmission).resolves.toEqual([]);
  });

  it('returns PRD row fields from getList and getById without sync metadata fields', async () => {
    const id = await bed.repo.createSnippet({
      name: 'List',
      command: 'ls -la',
      description: null,
      groupId: 'shell',
      runMode: 'insert',
    });

    const rows = await bed.repo.getList();
    const row = await bed.repo.getById(id);

    expect(rows).toHaveLength(1);
    expect(row).toEqual(rows[0]);
    expect(row).toMatchObject({
      id,
      name: 'List',
      command: 'ls -la',
      description: null,
      groupId: 'shell',
      runMode: 'insert',
    });
    expect(typeof (row as unknown as { createdAt: unknown }).createdAt).toBe('string');
    expect(typeof (row as unknown as { updatedAt: unknown }).updatedAt).toBe('string');
    expect(row).not.toHaveProperty('version');
    expect(row).not.toHaveProperty('deleted');
    expect(row).not.toHaveProperty('deletedAt');
  });

  it('emits add and update from syncUpsertRow', async () => {
    const events: Array<{ type: string; id: string }> = [];
    const subscription = bed.repo.changed$.subscribe((event) => events.push(event));

    await bed.repo.syncUpsertRow({
      id: 'snippet-1',
      name: 'Remote',
      command: 'echo remote',
      description: null,
      groupId: null,
      runMode: 'insert',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    } as unknown as ISyncEntityRow);
    await bed.repo.syncUpsertRow({
      id: 'snippet-1',
      name: 'Remote updated',
      command: 'echo updated',
      description: 'changed',
      groupId: 'g1',
      runMode: 'insert-run',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-02T00:00:00.000Z',
    } as unknown as ISyncEntityRow);

    expect(events).toEqual([
      { type: 'add', id: 'snippet-1' },
      { type: 'update', id: 'snippet-1' },
    ]);
    await expect(bed.repo.getById('snippet-1')).resolves.toMatchObject({
      name: 'Remote updated',
      command: 'echo updated',
      groupId: 'g1',
      runMode: 'insert-run',
    });
    subscription.unsubscribe();
  });

  it('emits delete from delete and removes the local row', async () => {
    await bed.repo.syncUpsertRow({
      id: 'snippet-1',
      name: 'Remote',
      command: 'echo remote',
      runMode: 'insert',
    } as unknown as ISyncEntityRow);
    const events: Array<{ type: string; id: string }> = [];
    const subscription = bed.repo.changed$.subscribe((event) => events.push(event));

    await bed.repo.delete('snippet-1');

    expect(events).toEqual([{ type: 'delete', id: 'snippet-1' }]);
    await expect(bed.repo.getById('snippet-1')).resolves.toBeNull();
    subscription.unsubscribe();
  });
});
