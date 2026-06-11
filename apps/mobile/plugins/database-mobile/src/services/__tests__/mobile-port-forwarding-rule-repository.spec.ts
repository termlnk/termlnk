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
import { MobilePortForwardingRuleRepository } from '../mobile-port-forwarding-rule-repository';

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
  readonly repo: MobilePortForwardingRuleRepository;
}

function createTestBed(): ITestBed {
  const sqlite = new BetterSqlite3(':memory:');
  sqlite.exec(`
    CREATE TABLE port_forwarding_rules (
      id text PRIMARY KEY NOT NULL,
      name text,
      type text NOT NULL,
      host_id text NOT NULL,
      bind_address text NOT NULL,
      bind_port integer NOT NULL,
      dest_host text,
      dest_port integer,
      auto_start integer DEFAULT false NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
    CREATE INDEX idx_pfr_host ON port_forwarding_rules (host_id);
  `);

  return {
    sqlite,
    repo: new MobilePortForwardingRuleRepository(new TestDatabaseMobileAdaptor(sqlite)),
  };
}

describe('MobilePortForwardingRuleRepository', () => {
  let bed: ITestBed;

  beforeEach(() => {
    bed = createTestBed();
  });

  afterEach(() => {
    bed.repo.dispose();
    bed.sqlite.close();
  });

  it('updates portForwardingRules$ after create, update, and delete', async () => {
    await bed.repo.ready();

    const createEmission = firstValueFrom(bed.repo.portForwardingRules$.pipe(skip(1), take(1)));
    const id = await bed.repo.createPortForwardingRule({
      name: 'Local web',
      type: 'local',
      hostId: 'h1',
      bindAddress: '127.0.0.1',
      bindPort: 8080,
      destHost: 'localhost',
      destPort: 80,
    });
    await expect(createEmission).resolves.toMatchObject([{ id, name: 'Local web' }]);

    const updateEmission = firstValueFrom(bed.repo.portForwardingRules$.pipe(skip(1), take(1)));
    await bed.repo.updatePortForwardingRule({
      id,
      name: 'Remote pg',
      type: 'remote',
      hostId: 'h2',
      bindAddress: '0.0.0.0',
      bindPort: 5432,
      destHost: '10.0.0.5',
      destPort: 5432,
      autoStart: true,
    });
    await expect(updateEmission).resolves.toMatchObject([{ id, name: 'Remote pg', hostId: 'h2', autoStart: true }]);

    const deleteEmission = firstValueFrom(bed.repo.portForwardingRules$.pipe(skip(1), take(1)));
    await bed.repo.deletePortForwardingRule(id);
    await expect(deleteEmission).resolves.toEqual([]);
  });

  it('returns PRD row fields from getList and getById without sync metadata fields', async () => {
    const id = await bed.repo.createPortForwardingRule({
      name: null,
      type: 'dynamic',
      hostId: 'h1',
      bindAddress: '127.0.0.1',
      bindPort: 1080,
      destHost: null,
      destPort: null,
    });

    const rows = await bed.repo.getList();
    const row = await bed.repo.getById(id);

    expect(rows).toHaveLength(1);
    expect(row).toEqual(rows[0]);
    expect(row).toMatchObject({
      id,
      name: null,
      type: 'dynamic',
      hostId: 'h1',
      bindAddress: '127.0.0.1',
      bindPort: 1080,
      destHost: null,
      destPort: null,
      autoStart: false,
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
      id: 'rule-1',
      name: null,
      type: 'dynamic',
      hostId: 'h1',
      bindAddress: '127.0.0.1',
      bindPort: 1080,
      destHost: null,
      destPort: null,
      autoStart: false,
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    } as unknown as ISyncEntityRow);
    await bed.repo.syncUpsertRow({
      id: 'rule-1',
      name: 'Local db',
      type: 'local',
      hostId: 'h2',
      bindAddress: '127.0.0.1',
      bindPort: 15432,
      destHost: 'localhost',
      destPort: 5432,
      autoStart: true,
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-02T00:00:00.000Z',
    } as unknown as ISyncEntityRow);

    expect(events).toEqual([
      { type: 'add', id: 'rule-1' },
      { type: 'update', id: 'rule-1' },
    ]);
    await expect(bed.repo.getById('rule-1')).resolves.toMatchObject({
      name: 'Local db',
      type: 'local',
      hostId: 'h2',
      bindPort: 15432,
      autoStart: true,
    });
    subscription.unsubscribe();
  });

  it('emits delete from delete and removes the local row', async () => {
    await bed.repo.syncUpsertRow({
      id: 'rule-1',
      name: null,
      type: 'dynamic',
      hostId: 'h1',
      bindAddress: '127.0.0.1',
      bindPort: 1080,
      destHost: null,
      destPort: null,
      autoStart: false,
    } as unknown as ISyncEntityRow);
    const events: Array<{ type: string; id: string }> = [];
    const subscription = bed.repo.changed$.subscribe((event) => events.push(event));

    await bed.repo.delete('rule-1');

    expect(events).toEqual([{ type: 'delete', id: 'rule-1' }]);
    await expect(bed.repo.getById('rule-1')).resolves.toBeNull();
    subscription.unsubscribe();
  });

  it('round-trips dynamic rules with null destination fields', async () => {
    await bed.repo.syncUpsertRow({
      id: 'dynamic-1',
      name: null,
      type: 'dynamic',
      hostId: 'h1',
      bindAddress: '127.0.0.1',
      bindPort: 1080,
      destHost: null,
      destPort: null,
      autoStart: false,
    } as unknown as ISyncEntityRow);

    await expect(bed.repo.getById('dynamic-1')).resolves.toMatchObject({
      type: 'dynamic',
      destHost: null,
      destPort: null,
    });
  });
});
