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
import type { ISecretCipherService } from '../services/secret-cipher.service';
import { getTableName } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProviderRepository } from './provider';

// Columns declared with drizzle's `{ mode: 'json' }` per table, mirroring
// src/entities/provider.ts. The fake below reproduces json mode's driver
// round-trip (stringify on write, parse on read) so a raw-string payload that
// slipped past normalisation would come back double-encoded and fail the tests.
const JSON_COLUMNS: Record<string, readonly string[]> = {
  ai_provider: ['headers'],
  ai_provider_model: ['overrides'],
  ai_custom_model: ['inputModes', 'cost', 'headers', 'compat'],
};

const NOT_NULL_COLUMNS: Record<string, readonly string[]> = {
  ai_custom_model: ['inputModes'],
};

function thenable<T>(compute: () => T) {
  return {
    then: (resolve: (value: T) => void, reject: (error: unknown) => void) =>
      Promise.resolve().then(compute).then(resolve, reject),
  };
}

/**
 * In-memory fake mirroring the drizzle execution modes ProviderRepository uses
 * (same approach as config.test.ts — the workspace better-sqlite3 binary is
 * compiled for Electron and cannot load under Node). It additionally emulates
 * json-mode column serialisation and NOT NULL enforcement, which is exactly the
 * cross-device contract under test.
 */
class FakeProviderDb {
  private readonly _tables = new Map<string, Map<string, Record<string, unknown>>>();

  private _rows(tableName: string): Map<string, Record<string, unknown>> {
    let rows = this._tables.get(tableName);
    if (!rows) {
      rows = new Map();
      this._tables.set(tableName, rows);
    }
    return rows;
  }

  private _encode(tableName: string, row: Record<string, unknown>): Record<string, unknown> {
    const encoded: Record<string, unknown> = { ...row };
    for (const column of JSON_COLUMNS[tableName] ?? []) {
      if (column in encoded) {
        encoded[column] = encoded[column] == null ? null : JSON.stringify(encoded[column]);
      }
    }
    for (const column of NOT_NULL_COLUMNS[tableName] ?? []) {
      if (column in encoded && encoded[column] === null) {
        throw new Error(`NOT NULL constraint failed: ${tableName}.${column}`);
      }
    }
    return encoded;
  }

  private _decode(tableName: string, row: Record<string, unknown>): Record<string, unknown> {
    const decoded: Record<string, unknown> = { ...row };
    for (const column of JSON_COLUMNS[tableName] ?? []) {
      if (typeof decoded[column] === 'string') {
        decoded[column] = JSON.parse(decoded[column] as string);
      }
    }
    return decoded;
  }

  select() {
    return {
      from: (table: unknown) => {
        const tableName = getTableName(table as never);
        return thenable(() => [...this._rows(tableName).values()].map((row) => this._decode(tableName, row)));
      },
    };
  }

  insert(table: unknown) {
    const tableName = getTableName(table as never);
    return {
      values: (row: Record<string, unknown>) => ({
        onConflictDoUpdate: ({ set }: { set: Record<string, unknown> }) =>
          thenable(() => {
            const rows = this._rows(tableName);
            const id = row.id as string;
            const existing = rows.get(id);
            if (existing) {
              rows.set(id, { ...existing, ...this._encode(tableName, set) });
            } else {
              rows.set(id, this._encode(tableName, row));
            }
          }),
      }),
    };
  }
}

function createTestBed() {
  const db = new FakeProviderDb();
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
  return { repository: new ProviderRepository(adaptor, cipher) };
}

describe('ProviderRepository sync payload normalisation', () => {
  let repository: ProviderRepository;

  beforeEach(() => {
    ({ repository } = createTestBed());
  });

  it('decodes legacy string JSON fields from mobile payloads instead of double-encoding', async () => {
    // Older mobile builds stored JSON columns as plain text and shipped the raw
    // string in the sync payload.
    await repository.upsertModelConfig({
      id: 'openai/gpt-4o',
      providerId: 'openai',
      modelId: 'gpt-4o',
      enabled: true,
      overrides: '{"name":"GPT-4o","contextWindow":128000}',
    });

    const [config] = await repository.getAllModelConfigs();
    expect(config.overrides).toEqual({ name: 'GPT-4o', contextWindow: 128000 });
  });

  it('keeps decoded JSON fields intact across an upsert round-trip', async () => {
    await repository.upsertProvider({
      id: 'openai',
      name: 'OpenAI',
      enabled: true,
      builtin: true,
      headers: { 'x-org': 'acme' },
      sort: 0,
    });
    // Conflict path must not re-encode either.
    await repository.upsertProvider({
      id: 'openai',
      name: 'OpenAI',
      enabled: true,
      builtin: true,
      headers: { 'x-org': 'acme' },
      sort: 1,
    });

    const [provider] = await repository.getProviders();
    expect(provider.headers).toEqual({ 'x-org': 'acme' });
  });

  it('falls back to the inputModes default when a mobile row ships null', async () => {
    await repository.upsertCustomModel({
      id: 'custom/model',
      providerId: 'custom',
      modelId: 'model',
      name: 'Custom',
      inputModes: null,
      cost: '{"input":1,"output":2}',
    });

    const [model] = await repository.getAllCustomModels();
    expect(model.inputModes).toEqual(['text']);
    expect(model.cost).toEqual({ input: 1, output: 2 });
  });
});
