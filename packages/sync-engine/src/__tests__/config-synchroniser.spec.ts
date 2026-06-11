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
import type { ConfigRepository, ISyncFieldMetaEntity, SyncFieldMetaRepository } from '@termlnk/database';
import type { ISyncCryptoService, ISyncMutation, ISyncOutboxService, SyncResourceId } from '@termlnk/sync';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigSynchroniser } from '../synchronisers/config-synchroniser';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

class FakeConfigRepo {
  store: Map<string, unknown> = new Map();
  changed$: Subject<{ type: 'set' | 'delete'; key: string; subKey?: string }> = new Subject();

  async get<T>(key: string): Promise<T | null> {
    return (this.store.get(key) ?? null) as T | null;
  }

  async getAll(): Promise<Array<{ key: string; value: unknown }>> {
    return [...this.store.entries()].map(([k, v]) => ({ key: k, value: v }));
  }

  async set(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
    this.changed$.next({ type: 'set', key });
  }

  async getField<T>(key: string, field: string): Promise<T | null> {
    const obj = this.store.get(key);
    if (!obj || typeof obj !== 'object') {
      return null;
    }
    return ((obj as Record<string, unknown>)[field] ?? null) as T | null;
  }

  async setField(key: string, field: string, value: unknown): Promise<void> {
    const obj = (this.store.get(key) as Record<string, unknown>) ?? {};
    obj[field] = value;
    this.store.set(key, obj);
    this.changed$.next({ type: 'set', key, subKey: field });
  }

  async deleteField(key: string, field: string): Promise<void> {
    const obj = this.store.get(key) as Record<string, unknown> | undefined;
    if (!obj) {
      return;
    }
    delete obj[field];
    this.store.set(key, obj);
    this.changed$.next({ type: 'delete', key, subKey: field });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
    this.changed$.next({ type: 'delete', key });
  }
}

class FakeFieldMetaRepo {
  rows: Map<string, ISyncFieldMetaEntity> = new Map();

  private _key(resource: SyncResourceId, entityId: string, field: string): string {
    return `${resource}::${entityId}::${field}`;
  }

  async get(resource: SyncResourceId, entityId: string, field: string): Promise<ISyncFieldMetaEntity | null> {
    return this.rows.get(this._key(resource, entityId, field)) ?? null;
  }

  async getByEntity(resource: SyncResourceId, entityId: string): Promise<ISyncFieldMetaEntity[]> {
    return [...this.rows.values()].filter((r) => r.resource === resource && r.entityId === entityId);
  }

  async getAllByResource(resource: SyncResourceId): Promise<ISyncFieldMetaEntity[]> {
    return [...this.rows.values()].filter((r) => r.resource === resource);
  }

  async upsert(meta: ISyncFieldMetaEntity): Promise<void> {
    this.rows.set(this._key(meta.resource, meta.entityId, meta.field), meta);
  }

  async delete(resource: SyncResourceId, entityId: string, field: string): Promise<void> {
    this.rows.delete(this._key(resource, entityId, field));
  }

  async deleteResource(resource: SyncResourceId): Promise<void> {
    for (const k of [...this.rows.keys()]) {
      if (this.rows.get(k)?.resource === resource) {
        this.rows.delete(k);
      }
    }
  }
}

class FakeOutbox implements ISyncOutboxService {
  enqueued: Array<Omit<ISyncMutation, 'id' | 'createdAt'>> = [];
  pendingCount$ = new Subject<number>();
  private _idCounter = 0;

  async enqueue(mutation: Omit<ISyncMutation, 'id' | 'createdAt'>): Promise<ISyncMutation> {
    this.enqueued.push(mutation);
    return { ...mutation, id: ++this._idCounter, createdAt: Date.now() } as ISyncMutation;
  }

  async peek(): Promise<ISyncMutation[]> {
    return [];
  }

  async ack(): Promise<void> {}
  async markRejected(): Promise<Map<number, number>> {
    return new Map();
  }

  async updateBaseVersion(): Promise<void> {}
  async discard(): Promise<void> {}

  async countByResource(): Promise<number> {
    return 0;
  }

  async clearResource(): Promise<void> {}
  async purgeByEntityIdPrefixes(): Promise<number> {
    return 0;
  }
}

class FakeCrypto implements ISyncCryptoService {
  available = true;

  encrypt(plaintext: Uint8Array): Uint8Array {
    const prefix = new TextEncoder().encode('FAKE_E:');
    const out = new Uint8Array(prefix.length + plaintext.length);
    out.set(prefix, 0);
    out.set(plaintext, prefix.length);
    return out;
  }

  decrypt(ciphertext: Uint8Array): Uint8Array {
    return ciphertext.subarray('FAKE_E:'.length);
  }

  hmacIndex(value: string): Uint8Array {
    return new TextEncoder().encode(`HMAC:${value}`);
  }
}

interface ITestBed {
  configRepo: FakeConfigRepo;
  fieldMeta: FakeFieldMetaRepo;
  outbox: FakeOutbox;
  crypto: FakeCrypto;
  syncer: ConfigSynchroniser;
}

function createTestBed(): ITestBed {
  const configRepo = new FakeConfigRepo();
  const fieldMeta = new FakeFieldMetaRepo();
  const outbox = new FakeOutbox();
  const crypto = new FakeCrypto();
  const syncer = new ConfigSynchroniser(
    configRepo as unknown as ConfigRepository,
    fieldMeta as unknown as SyncFieldMetaRepository,
    outbox,
    crypto,
    new NoopLogService()
  );
  return { configRepo, fieldMeta, outbox, crypto, syncer };
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('ConfigSynchroniser', () => {
  let bed: ITestBed;

  beforeEach(() => {
    bed = createTestBed();
  });

  afterEach(() => {
    bed.syncer.dispose();
  });

  it('exposes resourceId = "config"', () => {
    expect(bed.syncer.resourceId).toBe('config');
  });

  it('local subKey set emits one mutation with `<key>::<subKey>` entityId', async () => {
    bed.syncer.start();
    await bed.configRepo.setField('app.config', 'theme', 'nord');
    await flushAsync();

    expect(bed.outbox.enqueued).toHaveLength(1);
    expect(bed.outbox.enqueued[0].entityId).toBe('app.config::theme');
    expect(bed.outbox.enqueued[0].op).toBe('upsert');
  });

  it('local subKey delete emits a delete mutation', async () => {
    bed.syncer.start();
    await bed.configRepo.setField('app.config', 'theme', 'nord'); // populate
    bed.outbox.enqueued.length = 0; // discard the set we just made
    await bed.configRepo.deleteField('app.config', 'theme');
    await flushAsync();

    const deletes = bed.outbox.enqueued.filter((m) => m.op === 'delete');
    expect(deletes).toHaveLength(1);
    expect(deletes[0].entityId).toBe('app.config::theme');
  });

  it('local whole-key delete emits a delete with empty subKey', async () => {
    bed.syncer.start();
    await bed.configRepo.delete('app.config');
    await flushAsync();

    expect(bed.outbox.enqueued).toHaveLength(1);
    expect(bed.outbox.enqueued[0]).toMatchObject({
      op: 'delete',
      entityId: 'app.config::',
    });
  });

  it('local whole-key set decomposes into one mutation per existing subKey', async () => {
    bed.syncer.start();
    bed.configRepo.store.set('app.config', { theme: 'nord', lang: 'en-US' });
    await bed.configRepo.set('app.config', { theme: 'dracula', lang: 'en-US' });
    await flushAsync();

    expect(bed.outbox.enqueued).toHaveLength(2);
    expect(bed.outbox.enqueued.map((m) => m.entityId).sort()).toEqual([
      'app.config::lang',
      'app.config::theme',
    ]);
  });

  it('LWW: applyPatch with older payload.updatedAt is dropped', async () => {
    bed.syncer.start();
    // Simulate local field with newer timestamp
    await bed.fieldMeta.upsert({
      resource: 'config',
      entityId: 'app.config',
      field: 'theme',
      updatedAt: 1000,
    });
    bed.configRepo.store.set('app.config', { theme: 'nord' });

    const remotePayload = bed.crypto.encrypt(new TextEncoder().encode(JSON.stringify({
      value: 'dracula',
      updatedAt: 500, // older
    })));
    await bed.syncer.applyPatch([{
      op: 'put',
      resource: 'config',
      entityId: 'app.config::theme',
      payload: remotePayload,
      version: 1,
    }]);

    expect((bed.configRepo.store.get('app.config') as Record<string, unknown>).theme).toBe('nord');
  });

  it('LWW: applyPatch with newer payload.updatedAt overwrites local', async () => {
    bed.syncer.start();
    await bed.fieldMeta.upsert({
      resource: 'config',
      entityId: 'app.config',
      field: 'theme',
      updatedAt: 500,
    });
    bed.configRepo.store.set('app.config', { theme: 'nord' });

    const remotePayload = bed.crypto.encrypt(new TextEncoder().encode(JSON.stringify({
      value: 'dracula',
      updatedAt: 1000, // newer
    })));
    await bed.syncer.applyPatch([{
      op: 'put',
      resource: 'config',
      entityId: 'app.config::theme',
      payload: remotePayload,
      version: 1,
    }]);

    expect((bed.configRepo.store.get('app.config') as Record<string, unknown>).theme).toBe('dracula');
    expect((await bed.fieldMeta.get('config', 'app.config', 'theme'))?.updatedAt).toBe(1000);
  });

  it('applyPatch with no local sync_field_meta applies remote value', async () => {
    bed.syncer.start();
    const remotePayload = bed.crypto.encrypt(new TextEncoder().encode(JSON.stringify({
      value: 'firstWrite',
      updatedAt: 100,
    })));
    await bed.syncer.applyPatch([{
      op: 'put',
      resource: 'config',
      entityId: 'newKey::field1',
      payload: remotePayload,
      version: 1,
    }]);

    expect((bed.configRepo.store.get('newKey') as Record<string, unknown>).field1).toBe('firstWrite');
  });

  it('applyPatch op=del on subKey removes that field', async () => {
    bed.syncer.start();
    bed.configRepo.store.set('app.config', { theme: 'nord', lang: 'en-US' });

    await bed.syncer.applyPatch([{
      op: 'del',
      resource: 'config',
      entityId: 'app.config::theme',
      payload: null,
      version: 1,
    }]);

    expect(bed.configRepo.store.get('app.config')).toEqual({ lang: 'en-US' });
  });

  it('applyPatch op=del with empty subKey removes the whole key + clears all field meta', async () => {
    bed.syncer.start();
    bed.configRepo.store.set('app.config', { theme: 'nord' });
    await bed.fieldMeta.upsert({
      resource: 'config',
      entityId: 'app.config',
      field: 'theme',
      updatedAt: 1000,
    });

    await bed.syncer.applyPatch([{
      op: 'del',
      resource: 'config',
      entityId: 'app.config::',
      payload: null,
      version: 1,
    }]);

    expect(bed.configRepo.store.has('app.config')).toBe(false);
    expect(await bed.fieldMeta.get('config', 'app.config', 'theme')).toBeNull();
  });

  it('changed$ events fired during applyPatch do NOT fan back to outbox', async () => {
    bed.syncer.start();
    const remotePayload = bed.crypto.encrypt(new TextEncoder().encode(JSON.stringify({
      value: 'dracula',
      updatedAt: 1000,
    })));

    await bed.syncer.applyPatch([{
      op: 'put',
      resource: 'config',
      entityId: 'app.config::theme',
      payload: remotePayload,
      version: 1,
    }]);
    await flushAsync();

    expect(bed.outbox.enqueued).toHaveLength(0);
  });

  it('buildInitialSnapshot enumerates each subKey of object-valued config keys', async () => {
    bed.configRepo.store.set('app.config', { theme: 'nord', lang: 'en-US' });
    bed.configRepo.store.set('terminal.config', { fontSize: 14 });

    const snapshot = await bed.syncer.buildInitialSnapshot();
    expect(snapshot).toHaveLength(3);
    expect(bed.outbox.enqueued.map((m) => m.entityId).sort()).toEqual([
      'app.config::lang',
      'app.config::theme',
      'terminal.config::fontSize',
    ]);
  });

  it('buildInitialSnapshot skips fields that already have a sync_field_meta entry', async () => {
    bed.configRepo.store.set('app.config', { theme: 'nord', lang: 'en-US' });
    bed.configRepo.store.set('terminal.config', { fontSize: 14 });
    await bed.fieldMeta.upsert({ resource: 'config', entityId: 'app.config', field: 'theme', updatedAt: Date.now() });

    const snapshot = await bed.syncer.buildInitialSnapshot();
    expect(snapshot).toHaveLength(2);
    expect(bed.outbox.enqueued.map((m) => m.entityId).sort()).toEqual([
      'app.config::lang',
      'terminal.config::fontSize',
    ]);
  });

  it('decoded entityId rejects malformed forms (no `::` delimiter)', async () => {
    bed.syncer.start();
    await bed.syncer.applyPatch([{
      op: 'put',
      resource: 'config',
      entityId: 'no-delimiter-here',
      payload: bed.crypto.encrypt(new TextEncoder().encode('{}')),
      version: 1,
    }]);
    expect(bed.configRepo.store.size).toBe(0);
  });

  it('onPushAccepted decodes entityId and stamps sync_field_meta updatedAt', async () => {
    await bed.syncer.onPushAccepted({
      id: 3,
      resource: 'config',
      entityId: 'ui.config::theme',
      version: 11,
    });

    const meta = await bed.fieldMeta.get('config', 'ui.config', 'theme');
    expect(meta?.updatedAt).toBeGreaterThan(0);
    // config is field-level LWW — server `version` is intentionally not stored.
  });

  it('onPushAccepted handles whole-key entityIds with empty subKey', async () => {
    await bed.syncer.onPushAccepted({
      id: 4,
      resource: 'config',
      entityId: 'standalone-key::',
      version: 12,
    });

    const meta = await bed.fieldMeta.get('config', 'standalone-key', '');
    expect(meta?.updatedAt).toBeGreaterThan(0);
  });

  it('onPushAccepted is a no-op for malformed entityIds', async () => {
    await bed.syncer.onPushAccepted({
      id: 5,
      resource: 'config',
      entityId: 'no-delimiter',
      version: 13,
    });

    expect(bed.fieldMeta.rows.size).toBe(0);
  });

  it('reconcileGhostMeta drops field meta whose `<key>::<subKey>` composite is not in server set', async () => {
    // Three local field meta rows; server set carries only the first two.
    await bed.fieldMeta.upsert({ resource: 'config', entityId: 'ui.config', field: 'theme', updatedAt: 1 });
    await bed.fieldMeta.upsert({ resource: 'config', entityId: 'ui.config', field: 'locale', updatedAt: 2 });
    await bed.fieldMeta.upsert({ resource: 'config', entityId: 'ai.config', field: 'ghost-field', updatedAt: 3 });

    await bed.syncer.reconcileGhostMeta(new Set([
      'ui.config::theme',
      'ui.config::locale',
    ]));

    expect(await bed.fieldMeta.get('config', 'ui.config', 'theme')).not.toBeNull();
    expect(await bed.fieldMeta.get('config', 'ui.config', 'locale')).not.toBeNull();
    expect(await bed.fieldMeta.get('config', 'ai.config', 'ghost-field')).toBeNull();
  });
});
