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
import type { IAICustomModelEntity, IAIProviderEntity, IAIProviderEntityInsert, IAIProviderModelEntity, ISyncRowMetaEntity, ProviderRepository, SyncRowMetaRepository } from '@termlnk/database';
import type { ISyncCryptoService, ISyncMutation, ISyncOutboxService, SyncResourceId } from '@termlnk/sync';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProviderSynchroniser } from '../synchronisers/provider-synchroniser';

class NoopLogService implements ILogService {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
  deprecate(): void {}
  setLogLevel(_level: LogLevel): void {}
}

class FakeProviderRepo {
  providers: Map<string, IAIProviderEntity> = new Map();
  modelConfigs: Map<string, IAIProviderModelEntity> = new Map();
  customModels: Map<string, IAICustomModelEntity> = new Map();
  changed$: Subject<{ type: 'provider' | 'model-config' | 'custom-model'; action: 'set' | 'delete'; id: string }> = new Subject();

  async getProviders(): Promise<IAIProviderEntity[]> {
    return [...this.providers.values()];
  }

  async getProviderById(id: string): Promise<IAIProviderEntity | null> {
    return this.providers.get(id) ?? null;
  }

  async upsertProvider(data: IAIProviderEntityInsert): Promise<void> {
    this.providers.set(data.id, data as IAIProviderEntity);
    this.changed$.next({ type: 'provider', action: 'set', id: data.id });
  }

  async deleteProvider(id: string): Promise<void> {
    // Cascade like the real repo
    for (const [k, v] of this.modelConfigs) {
      if (v.providerId === id) {
        this.modelConfigs.delete(k);
      }
    }
    for (const [k, v] of this.customModels) {
      if (v.providerId === id) {
        this.customModels.delete(k);
      }
    }
    this.providers.delete(id);
    this.changed$.next({ type: 'provider', action: 'delete', id });
  }

  async getAllModelConfigs(): Promise<IAIProviderModelEntity[]> {
    return [...this.modelConfigs.values()];
  }

  async upsertModelConfig(data: IAIProviderModelEntity): Promise<void> {
    this.modelConfigs.set(data.id, data);
    this.changed$.next({ type: 'model-config', action: 'set', id: data.id });
  }

  async deleteModelConfig(id: string): Promise<void> {
    this.modelConfigs.delete(id);
    this.changed$.next({ type: 'model-config', action: 'delete', id });
  }

  async getAllCustomModels(): Promise<IAICustomModelEntity[]> {
    return [...this.customModels.values()];
  }

  async upsertCustomModel(data: IAICustomModelEntity): Promise<void> {
    this.customModels.set(data.id, data);
    this.changed$.next({ type: 'custom-model', action: 'set', id: data.id });
  }

  async deleteCustomModel(id: string): Promise<void> {
    this.customModels.delete(id);
    this.changed$.next({ type: 'custom-model', action: 'delete', id });
  }
}

class FakeRowMetaRepo {
  rows: Map<string, ISyncRowMetaEntity> = new Map();

  private _key(resource: SyncResourceId, entityId: string): string {
    return `${resource}::${entityId}`;
  }

  async get(resource: SyncResourceId, entityId: string): Promise<ISyncRowMetaEntity | null> {
    return this.rows.get(this._key(resource, entityId)) ?? null;
  }

  async upsert(meta: ISyncRowMetaEntity): Promise<void> {
    this.rows.set(this._key(meta.resource, meta.entityId), meta);
  }

  async delete(resource: SyncResourceId, entityId: string): Promise<void> {
    this.rows.delete(this._key(resource, entityId));
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

function makeProvider(id: string, overrides: Partial<IAIProviderEntity> = {}): IAIProviderEntity {
  return {
    id,
    name: 'p',
    enabled: true,
    builtin: false,
    api: null,
    apiKey: 'sk-test',
    baseUrl: null,
    headers: null,
    sort: 0,
    accessedAt: '2026-05-09',
    createdAt: '2026-05-09',
    updatedAt: '2026-05-09',
    ...overrides,
  };
}

function makeModelConfig(id: string, providerId: string): IAIProviderModelEntity {
  return {
    id,
    providerId,
    modelId: 'm-foo',
    enabled: true,
    overrides: null,
    accessedAt: '2026-05-09',
    createdAt: '2026-05-09',
    updatedAt: '2026-05-09',
  };
}

function makeCustomModel(id: string, providerId: string): IAICustomModelEntity {
  return {
    id,
    providerId,
    modelId: 'cm-foo',
    name: 'foo',
    api: null,
    baseUrl: null,
    reasoning: false,
    inputModes: ['text'],
    cost: null,
    contextWindow: 128000,
    maxTokens: 16384,
    headers: null,
    compat: null,
    sort: 0,
    accessedAt: '2026-05-09',
    createdAt: '2026-05-09',
    updatedAt: '2026-05-09',
  };
}

interface ITestBed {
  providerRepo: FakeProviderRepo;
  rowMeta: FakeRowMetaRepo;
  outbox: FakeOutbox;
  crypto: FakeCrypto;
  syncer: ProviderSynchroniser;
}

function createTestBed(): ITestBed {
  const providerRepo = new FakeProviderRepo();
  const rowMeta = new FakeRowMetaRepo();
  const outbox = new FakeOutbox();
  const crypto = new FakeCrypto();
  const syncer = new ProviderSynchroniser(
    providerRepo as unknown as ProviderRepository,
    rowMeta as unknown as SyncRowMetaRepository,
    outbox,
    crypto,
    new NoopLogService()
  );
  return { providerRepo, rowMeta, outbox, crypto, syncer };
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('ProviderSynchroniser', () => {
  let bed: ITestBed;

  beforeEach(() => {
    bed = createTestBed();
  });

  afterEach(() => {
    bed.syncer.dispose();
  });

  it('exposes resourceId = "ai_provider"', () => {
    expect(bed.syncer.resourceId).toBe('ai_provider');
  });

  it('local provider update emits an upsert with `prov:` prefix', async () => {
    bed.syncer.start();
    bed.providerRepo.providers.set('p1', makeProvider('p1', { name: 'updated' }));
    bed.providerRepo.changed$.next({ type: 'provider', action: 'set', id: 'p1' });

    await flushAsync();
    expect(bed.outbox.enqueued).toHaveLength(1);
    expect(bed.outbox.enqueued[0].entityId).toBe('prov:p1');
    expect(bed.outbox.enqueued[0].op).toBe('upsert');
  });

  it('local model-config update emits an upsert with `pmod:` prefix', async () => {
    bed.syncer.start();
    bed.providerRepo.modelConfigs.set('mc1', makeModelConfig('mc1', 'p1'));
    bed.providerRepo.changed$.next({ type: 'model-config', action: 'set', id: 'mc1' });

    await flushAsync();
    expect(bed.outbox.enqueued).toHaveLength(1);
    expect(bed.outbox.enqueued[0].entityId).toBe('pmod:mc1');
  });

  it('local custom-model update emits an upsert with `cmod:` prefix', async () => {
    bed.syncer.start();
    bed.providerRepo.customModels.set('cm1', makeCustomModel('cm1', 'p1'));
    bed.providerRepo.changed$.next({ type: 'custom-model', action: 'set', id: 'cm1' });

    await flushAsync();
    expect(bed.outbox.enqueued).toHaveLength(1);
    expect(bed.outbox.enqueued[0].entityId).toBe('cmod:cm1');
  });

  it('applyPatch op=put dispatches to the right Repository upsert based on entityId prefix', async () => {
    bed.syncer.start();

    const provRow = makeProvider('p1', { name: 'remote' });
    const provPayload = bed.crypto.encrypt(new TextEncoder().encode(JSON.stringify({ kind: 'provider', row: provRow })));
    await bed.syncer.applyPatch([{
      op: 'put',
      resource: 'ai_provider',
      entityId: 'prov:p1',
      payload: provPayload,
      version: 1,
    }]);
    expect(bed.providerRepo.providers.get('p1')?.name).toBe('remote');

    const mcRow = makeModelConfig('mc1', 'p1');
    const mcPayload = bed.crypto.encrypt(new TextEncoder().encode(JSON.stringify({ kind: 'modelConfig', row: mcRow })));
    await bed.syncer.applyPatch([{
      op: 'put',
      resource: 'ai_provider',
      entityId: 'pmod:mc1',
      payload: mcPayload,
      version: 2,
    }]);
    expect(bed.providerRepo.modelConfigs.has('mc1')).toBe(true);

    const cmRow = makeCustomModel('cm1', 'p1');
    const cmPayload = bed.crypto.encrypt(new TextEncoder().encode(JSON.stringify({ kind: 'customModel', row: cmRow })));
    await bed.syncer.applyPatch([{
      op: 'put',
      resource: 'ai_provider',
      entityId: 'cmod:cm1',
      payload: cmPayload,
      version: 3,
    }]);
    expect(bed.providerRepo.customModels.has('cm1')).toBe(true);
  });

  it('applyPatch op=del routes by prefix', async () => {
    bed.syncer.start();
    bed.providerRepo.providers.set('p1', makeProvider('p1'));
    bed.providerRepo.modelConfigs.set('mc1', makeModelConfig('mc1', 'p1'));

    await bed.syncer.applyPatch([
      { op: 'del', resource: 'ai_provider', entityId: 'pmod:mc1', payload: null, version: 4 },
      { op: 'del', resource: 'ai_provider', entityId: 'prov:p1', payload: null, version: 5 },
    ]);

    // Note: deleting prov:p1 also cascades on the fake (mirrors real Repository) — fine.
    expect(bed.providerRepo.modelConfigs.has('mc1')).toBe(false);
    expect(bed.providerRepo.providers.has('p1')).toBe(false);
  });

  it('applyPatch rejects payloads whose kind disagrees with the entityId prefix', async () => {
    bed.syncer.start();
    const provRow = makeProvider('p1');
    // Encode as 'modelConfig' but route to 'prov:' — should be ignored
    const payload = bed.crypto.encrypt(new TextEncoder().encode(JSON.stringify({ kind: 'modelConfig', row: provRow })));
    await bed.syncer.applyPatch([{
      op: 'put',
      resource: 'ai_provider',
      entityId: 'prov:p1',
      payload,
      version: 1,
    }]);
    expect(bed.providerRepo.providers.has('p1')).toBe(false);
  });

  it('applyPatch ignores entityIds with an unrecognised prefix', async () => {
    bed.syncer.start();
    await bed.syncer.applyPatch([{
      op: 'put',
      resource: 'ai_provider',
      entityId: 'xyz:something',
      payload: bed.crypto.encrypt(new TextEncoder().encode('{}')),
      version: 1,
    }]);
    // Nothing crashed; nothing was applied
    expect(bed.providerRepo.providers.size).toBe(0);
  });

  it('changed$ events emitted while applyPatch is running do NOT fan back to outbox', async () => {
    bed.syncer.start();
    const row = makeProvider('p1');
    const payload = bed.crypto.encrypt(new TextEncoder().encode(JSON.stringify({ kind: 'provider', row })));
    await bed.syncer.applyPatch([{
      op: 'put',
      resource: 'ai_provider',
      entityId: 'prov:p1',
      payload,
      version: 1,
    }]);
    await flushAsync();
    expect(bed.outbox.enqueued).toHaveLength(0);
  });

  it('buildInitialSnapshot enqueues mutations for every provider, model-config, and custom-model row', async () => {
    bed.providerRepo.providers.set('p1', makeProvider('p1'));
    bed.providerRepo.providers.set('p2', makeProvider('p2'));
    bed.providerRepo.modelConfigs.set('mc1', makeModelConfig('mc1', 'p1'));
    bed.providerRepo.customModels.set('cm1', makeCustomModel('cm1', 'p1'));

    const snapshot = await bed.syncer.buildInitialSnapshot();
    expect(snapshot).toHaveLength(4);
    expect(bed.outbox.enqueued.map((m) => m.entityId).sort()).toEqual([
      'cmod:cm1',
      'pmod:mc1',
      'prov:p1',
      'prov:p2',
    ]);
  });

  it('buildInitialSnapshot skips rows that already have a sync_row_meta entry', async () => {
    bed.providerRepo.providers.set('p1', makeProvider('p1'));
    bed.providerRepo.providers.set('p2', makeProvider('p2'));
    bed.providerRepo.modelConfigs.set('mc1', makeModelConfig('mc1', 'p1'));
    bed.providerRepo.customModels.set('cm1', makeCustomModel('cm1', 'p1'));
    await bed.rowMeta.upsert({ resource: 'ai_provider', entityId: 'prov:p1', version: 4, updatedAt: Date.now() });
    await bed.rowMeta.upsert({ resource: 'ai_provider', entityId: 'cmod:cm1', version: 5, updatedAt: Date.now() });

    const snapshot = await bed.syncer.buildInitialSnapshot();

    expect(snapshot).toHaveLength(2);
    expect(bed.outbox.enqueued.map((m) => m.entityId).sort()).toEqual([
      'pmod:mc1',
      'prov:p2',
    ]);
  });

  it('dispose unsubscribes — subsequent changed$ events are ignored', async () => {
    bed.syncer.start();
    bed.syncer.dispose();
    bed.providerRepo.changed$.next({ type: 'provider', action: 'set', id: 'p1' });
    await flushAsync();
    expect(bed.outbox.enqueued).toHaveLength(0);
  });
});
