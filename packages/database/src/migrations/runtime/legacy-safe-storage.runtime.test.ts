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

import type { ILogService } from '@termlnk/core';
import type { LegacyTokenRewrap } from './legacy-safe-storage.runtime';
import { Buffer } from 'node:buffer';
import { join } from 'node:path';
import process from 'node:process';
import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { describe, expect, it, vi } from 'vitest';
import { aiProviderEntity } from '../../entities/provider';
import { LocalDerivedSecretCipher } from '../../services/secret-cipher/local-derived.cipher';
import { decodeSecretPayload, encodeSecretPayload } from '../../services/secret-cipher/secret-payload';
import { runEncryptSecretsRuntimeMigration } from './encrypt-secrets.runtime';
import { migrateLegacySafeStorageSecrets } from './legacy-safe-storage.runtime';

const logService = {
  debug: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  deprecate: vi.fn(),
  setLogLevel: vi.fn(),
} as unknown as ILogService;

function legacyToken(plain: string): string {
  return encodeSecretPayload({ scheme: 'safe-storage', ciphertext: Buffer.from(plain).toString('base64') });
}

function envelopeToken(plain: string): string {
  return encodeSecretPayload({ scheme: 'safe-storage-envelope', ciphertext: Buffer.from(plain).toString('base64') });
}

// Stand-in for the keystore: legacy ciphertext is base64 plaintext, envelope likewise.
const rewrap: LegacyTokenRewrap = async (token) => {
  const plain = Buffer.from(decodeSecretPayload(token).ciphertext, 'base64').toString();
  return envelopeToken(plain);
};

function createDb() {
  const client = new BetterSqlite3(':memory:');
  client.exec(`
    CREATE TABLE plain_tbl (id TEXT PRIMARY KEY, secret TEXT, other TEXT, n INTEGER, raw BLOB);
    CREATE TABLE json_tbl (id INTEGER PRIMARY KEY, cfg TEXT);
    CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT);
  `);
  return { client, db: drizzle({ client }) };
}

describe('migrateLegacySafeStorageSecrets', () => {
  it('rewrites a plain column and leaves untouched rows alone', async () => {
    const { client, db } = createDb();
    client.prepare('INSERT INTO plain_tbl (id, secret, other) VALUES (?, ?, ?)').run('a', legacyToken('pw-a'), 'keep');
    client.prepare('INSERT INTO plain_tbl (id, secret) VALUES (?, ?)').run('b', 'no-secret');

    const result = await migrateLegacySafeStorageSecrets(db, rewrap, logService);

    const rows = client.prepare('SELECT * FROM plain_tbl ORDER BY id').all() as Array<{ id: string; secret: string; other: string }>;
    expect(rows[0].secret).toBe(envelopeToken('pw-a'));
    expect(rows[0].other).toBe('keep');
    expect(rows[1].secret).toBe('no-secret');
    expect(result).toMatchObject({ tokensRewrapped: 1, tokensFailed: 0, rowsUpdated: 1 });
  });

  it('rewrites nested tokens in JSON cells, including several tokens in one cell', async () => {
    const { client, db } = createDb();
    const cfg = JSON.stringify({
      type: 'stdio',
      env: { A: legacyToken('one'), B: legacyToken('two'), C: legacyToken('one') },
      nested: [{ headers: { Authorization: legacyToken('three') } }],
    });
    client.prepare('INSERT INTO json_tbl (cfg) VALUES (?)').run(cfg);

    const result = await migrateLegacySafeStorageSecrets(db, rewrap, logService);

    const stored = JSON.parse((client.prepare('SELECT cfg FROM json_tbl').get() as { cfg: string }).cfg);
    expect(stored.env).toEqual({ A: envelopeToken('one'), B: envelopeToken('two'), C: envelopeToken('one') });
    expect(stored.nested[0].headers.Authorization).toBe(envelopeToken('three'));
    expect(stored.type).toBe('stdio');
    expect(result.tokensRewrapped).toBe(3);
    expect(result.rowsUpdated).toBe(1);
  });

  it('leaves non-legacy tokens, blobs, integers and the drizzle migrations table untouched', async () => {
    const { client, db } = createDb();
    const envelope = envelopeToken('x');
    const local = encodeSecretPayload({ scheme: 'local-derived', iv: 'AA==', ciphertext: 'AA==', tag: 'AA==' });
    const blob = Buffer.from(legacyToken('in-blob'));
    client.prepare('INSERT INTO plain_tbl (id, secret, other, raw) VALUES (?, ?, ?, ?)').run('a', envelope, local, blob);
    client.prepare('INSERT INTO __drizzle_migrations (hash) VALUES (?)').run(legacyToken('migrations'));
    const rewrapSpy = vi.fn(rewrap);

    const result = await migrateLegacySafeStorageSecrets(db, rewrapSpy, logService);

    expect(rewrapSpy).not.toHaveBeenCalled();
    const row = client.prepare('SELECT * FROM plain_tbl').get() as { secret: string; other: string; raw: Buffer };
    expect(row.secret).toBe(envelope);
    expect(row.other).toBe(local);
    expect(row.raw.equals(blob)).toBe(true);
    expect((client.prepare('SELECT hash FROM __drizzle_migrations').get() as { hash: string }).hash).toBe(legacyToken('migrations'));
    expect(result).toMatchObject({ tokensRewrapped: 0, tokensFailed: 0, rowsUpdated: 0 });
  });

  it('keeps the original value when rewrap fails or declines, and migrates the rest', async () => {
    const { client, db } = createDb();
    const bad = legacyToken('bad');
    const declined = legacyToken('declined');
    const good = legacyToken('good');
    client.prepare('INSERT INTO plain_tbl (id, secret) VALUES (?, ?)').run('bad', bad);
    client.prepare('INSERT INTO plain_tbl (id, secret) VALUES (?, ?)').run('declined', declined);
    client.prepare('INSERT INTO json_tbl (cfg) VALUES (?)').run(JSON.stringify({ k: good, m: bad }));
    const flaky: LegacyTokenRewrap = async (token) => {
      if (token === bad) {
        throw new Error('keystore locked');
      }
      return token === declined ? null : rewrap(token);
    };

    const result = await migrateLegacySafeStorageSecrets(db, flaky, logService);

    const secrets = client.prepare('SELECT id, secret FROM plain_tbl ORDER BY id').all() as Array<{ id: string; secret: string }>;
    expect(secrets.map((r) => r.secret)).toEqual([bad, declined]);
    expect(JSON.parse((client.prepare('SELECT cfg FROM json_tbl').get() as { cfg: string }).cfg)).toEqual({
      k: envelopeToken('good'),
      m: bad,
    });
    expect(result).toMatchObject({ tokensRewrapped: 1, tokensFailed: 3, rowsUpdated: 1 });
  });

  it('is idempotent: a second run finds nothing to do', async () => {
    const { client, db } = createDb();
    client.prepare('INSERT INTO plain_tbl (id, secret) VALUES (?, ?)').run('a', legacyToken('pw'));

    await migrateLegacySafeStorageSecrets(db, rewrap, logService);
    const rewrapSpy = vi.fn(rewrap);
    const second = await migrateLegacySafeStorageSecrets(db, rewrapSpy, logService);

    expect(rewrapSpy).not.toHaveBeenCalled();
    expect(second).toMatchObject({ tokensRewrapped: 0, rowsUpdated: 0 });
  });
});

describe('encrypt-secrets sanitize', () => {
  it('does not clear legacy safe-storage payloads but still clears corrupted local-derived ones', async () => {
    const client = new BetterSqlite3(':memory:');
    const db = drizzle({ client });
    migrate(db, { migrationsFolder: join(process.cwd(), 'src/migrations') });

    const staleKey = new LocalDerivedSecretCipher();
    const corrupted = new LocalDerivedSecretCipher(Buffer.alloc(32, 7)).encrypt('old-key-secret');
    const legacy = legacyToken('legacy-secret');
    await db.insert(aiProviderEntity).values([
      { id: 'legacy', name: 'legacy', apiKey: legacy },
      { id: 'corrupted', name: 'corrupted', apiKey: corrupted },
    ]);

    const result = await runEncryptSecretsRuntimeMigration(db, staleKey);

    const rows = client.prepare('SELECT id, api_key FROM ai_provider ORDER BY id').all() as Array<{ id: string; api_key: string }>;
    expect(rows.find((r) => r.id === 'legacy')!.api_key).toBe(legacy);
    expect(rows.find((r) => r.id === 'corrupted')!.api_key).toBe('');
    expect(result.sanitized).toBe(1);
  });
});
