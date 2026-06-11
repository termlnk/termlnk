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
import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as entities from '../entities';
import { PortForwardingRuleRepository } from './port-forwarding-rule';

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

interface ITestBed {
  sqlite: BetterSqlite3.Database;
  repo: PortForwardingRuleRepository;
}

function createTestBed(): ITestBed {
  const sqlite = new BetterSqlite3(':memory:');
  sqlite.exec(`
    CREATE TABLE port_forwarding_rule (
      id text PRIMARY KEY NOT NULL,
      name text,
      type text NOT NULL,
      host_id text NOT NULL,
      bind_address text DEFAULT '127.0.0.1' NOT NULL,
      bind_port integer NOT NULL,
      dest_host text,
      dest_port integer,
      auto_start integer DEFAULT false NOT NULL,
      accessed_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `);
  return {
    sqlite,
    repo: new PortForwardingRuleRepository(new TestDBAdaptor(sqlite)),
  };
}

describe('PortForwardingRuleRepository', () => {
  let bed: ITestBed;

  beforeEach(() => {
    bed = createTestBed();
  });

  afterEach(() => {
    bed.repo.dispose();
    bed.sqlite.close();
  });

  it('creates port forwarding rules and applies defaults', async () => {
    const id = await bed.repo.create({
      name: 'Local web',
      type: 'local',
      hostId: 'h1',
      bindPort: 8080,
      destHost: '127.0.0.1',
      destPort: 80,
    });

    await expect(bed.repo.getById(id)).resolves.toMatchObject({
      id,
      name: 'Local web',
      type: 'local',
      hostId: 'h1',
      bindAddress: '127.0.0.1',
      bindPort: 8080,
      destHost: '127.0.0.1',
      destPort: 80,
      autoStart: false,
    });
  });

  it('updates rules and emits changed$ events for create/update/delete', async () => {
    const events: Array<{ type: string; id: string }> = [];
    const subscription = bed.repo.changed$.subscribe((event) => events.push(event));
    const id = await bed.repo.create({
      name: null,
      type: 'dynamic',
      hostId: 'h1',
      bindPort: 1080,
    });

    await bed.repo.update(id, { name: 'Socks', autoStart: true });
    await bed.repo.delete(id);

    expect(events).toEqual([
      { type: 'add', id },
      { type: 'update', id },
      { type: 'delete', id },
    ]);
    await expect(bed.repo.getById(id)).resolves.toBeUndefined();
    subscription.unsubscribe();
  });

  it('syncUpsertRow inserts and updates idempotently', async () => {
    const events: Array<{ type: string; id: string }> = [];
    const subscription = bed.repo.changed$.subscribe((event) => events.push(event));

    await bed.repo.syncUpsertRow({
      id: 'r1',
      name: null,
      type: 'remote',
      hostId: 'h1',
      bindAddress: '0.0.0.0',
      bindPort: 9000,
      destHost: '10.0.0.5',
      destPort: 5432,
      autoStart: false,
      accessedAt: '2026-06-01T00:00:00.000Z',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    });
    await bed.repo.syncUpsertRow({
      id: 'r1',
      name: 'Updated',
      type: 'local',
      hostId: 'h2',
      bindAddress: '127.0.0.1',
      bindPort: 7000,
      destHost: 'localhost',
      destPort: 7001,
      autoStart: true,
      accessedAt: '2026-06-01T00:00:00.000Z',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-02T00:00:00.000Z',
    });

    await expect(bed.repo.getList()).resolves.toHaveLength(1);
    await expect(bed.repo.getById('r1')).resolves.toMatchObject({
      name: 'Updated',
      type: 'local',
      hostId: 'h2',
      bindPort: 7000,
      autoStart: true,
    });
    expect(events).toEqual([
      { type: 'add', id: 'r1' },
      { type: 'update', id: 'r1' },
    ]);
    subscription.unsubscribe();
  });
});
