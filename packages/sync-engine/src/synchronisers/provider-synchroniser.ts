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

import type { IPushAcceptedDetail, IResourceSynchroniser, ISyncEntityRow, ISyncMutation, ISyncPatchApplyResult, ISyncPatchItem } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import { ILogService, RxDisposable } from '@termlnk/core';
import { IProviderSyncRepository, ISyncCryptoService, ISyncOutboxService, ISyncRowMetaRepository, SynchroniserStatus } from '@termlnk/sync';
import { BehaviorSubject } from 'rxjs';
import { applyPatchItems } from './apply-patch';

const RESOURCE_ID = 'ai_provider' as const;
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

// EntityId prefixes that fold three related tables onto a single `ai_provider` resource
// id, instead of expanding the SyncResourceId enum.
const KIND_PREFIX = {
  provider: 'prov:',
  modelConfig: 'pmod:',
  customModel: 'cmod:',
} as const;

type ProviderKind = keyof typeof KIND_PREFIX;

interface IProviderPayload {
  readonly kind: ProviderKind;
  readonly row: ISyncEntityRow;
}

// Row-level LWW across three tables (ai_provider / ai_provider_model / ai_custom_model).
// EntityId prefix dispatches applyPatch to the right upsert. deleteProvider cascades on
// both sides, so a single provider-delete mutation converges both ends.
export class ProviderSynchroniser extends RxDisposable implements IResourceSynchroniser {
  readonly resourceId = RESOURCE_ID;

  private readonly _status$ = new BehaviorSubject<SynchroniserStatus>(SynchroniserStatus.Idle);
  readonly status$: Observable<SynchroniserStatus> = this._status$.asObservable();

  private _applyingPatch = false;
  private _started = false;

  constructor(
    @IProviderSyncRepository private readonly _providerRepo: IProviderSyncRepository,
    @ISyncRowMetaRepository private readonly _rowMetaRepo: ISyncRowMetaRepository,
    @ISyncOutboxService private readonly _outboxService: ISyncOutboxService,
    @ISyncCryptoService private readonly _cryptoService: ISyncCryptoService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  override dispose(): void {
    this._status$.complete();
    super.dispose();
  }

  start(): void {
    if (this._started) {
      return;
    }
    this._started = true;
    this.disposeWithMe(
      this._providerRepo.changed$.subscribe((event) => {
        if (this._applyingPatch) {
          return;
        }
        const kind = this._eventTypeToKind(event.type);
        if (!kind) {
          return;
        }
        void this._handleLocalChange(kind, event.id, event.action);
      })
    );
  }

  async applyPatch(patch: ISyncPatchItem[]): Promise<ISyncPatchApplyResult> {
    if (patch.length === 0) {
      return { failures: [] };
    }
    this._status$.next(SynchroniserStatus.ApplyingPatch);
    this._applyingPatch = true;
    try {
      // Per-item tolerance: one bad row (stale ciphertext, malformed payload) must not
      // block the rest of the batch. The caller decides how to treat the failures.
      return await applyPatchItems(patch, RESOURCE_ID, (item) => this._applyOne(item));
    } finally {
      this._applyingPatch = false;
      this._status$.next(SynchroniserStatus.Idle);
    }
  }

  async buildMutations(): Promise<ISyncMutation[]> {
    return [];
  }

  async onPushAccepted(detail: IPushAcceptedDetail): Promise<void> {
    // entityId already encodes the kind prefix (prov:/pmod:/cmod:); store it verbatim so
    // buildInitialSnapshot's per-kind dedupe lookup hits the right row.
    await this._rowMetaRepo.upsert({
      resource: RESOURCE_ID,
      entityId: detail.entityId,
      version: detail.version,
      updatedAt: Date.now(),
    });
  }

  async reconcileGhostMeta(serverEntityIds: ReadonlySet<string>): Promise<void> {
    const all = await this._rowMetaRepo.getAll(RESOURCE_ID);
    for (const meta of all) {
      if (!serverEntityIds.has(meta.entityId)) {
        this._logService.log(`[ProviderSynchroniser] dropping ghost meta for ${meta.entityId}`);
        await this._rowMetaRepo.delete(RESOURCE_ID, meta.entityId);
      }
    }
  }

  async buildInitialSnapshot(): Promise<ISyncMutation[]> {
    // Skip rows that already have sync_row_meta so re-enable() never re-pushes.
    const out: ISyncMutation[] = [];

    const providers = await this._providerRepo.getProviders();
    for (const row of providers) {
      const mutation = await this._enqueueUpsertIfUnsynced('provider', row, row.id);
      if (mutation) {
        out.push(mutation);
      }
    }

    const modelConfigs = await this._providerRepo.getAllModelConfigs();
    for (const row of modelConfigs) {
      const mutation = await this._enqueueUpsertIfUnsynced('modelConfig', row, row.id);
      if (mutation) {
        out.push(mutation);
      }
    }

    const customModels = await this._providerRepo.getAllCustomModels();
    for (const row of customModels) {
      const mutation = await this._enqueueUpsertIfUnsynced('customModel', row, row.id);
      if (mutation) {
        out.push(mutation);
      }
    }

    return out;
  }

  private async _enqueueUpsertIfUnsynced(kind: ProviderKind, row: ISyncEntityRow, id: string): Promise<ISyncMutation | null> {
    const entityId = `${KIND_PREFIX[kind]}${id}`;
    const meta = await this._rowMetaRepo.get(RESOURCE_ID, entityId);
    if (meta) {
      return null;
    }
    return this._outboxService.enqueue(this._buildUpsertMutation(kind, row, entityId, null));
  }

  private _eventTypeToKind(type: 'provider' | 'model-config' | 'custom-model'): ProviderKind | null {
    switch (type) {
      case 'provider':
        return 'provider';
      case 'model-config':
        return 'modelConfig';
      case 'custom-model':
        return 'customModel';
    }
  }

  private async _handleLocalChange(kind: ProviderKind, id: string, action: 'set' | 'delete'): Promise<void> {
    try {
      this._status$.next(SynchroniserStatus.PushingMutations);
      const entityId = `${KIND_PREFIX[kind]}${id}`;
      const meta = await this._rowMetaRepo.get(RESOURCE_ID, entityId);
      const baseVersion = meta?.version ?? null;

      if (action === 'delete') {
        await this._outboxService.enqueue({
          resource: RESOURCE_ID,
          op: 'delete',
          entityId,
          payload: null,
          baseVersion,
        });
        return;
      }

      const row = await this._readRow(kind, id);
      if (!row) {
        await this._outboxService.enqueue({
          resource: RESOURCE_ID,
          op: 'delete',
          entityId,
          payload: null,
          baseVersion,
        });
        return;
      }

      await this._outboxService.enqueue(this._buildUpsertMutation(kind, row, entityId, baseVersion));
    } catch (err) {
      if (!this._cryptoService.available) {
        this._status$.next(SynchroniserStatus.CryptoLocked);
        return;
      }
      this._logService.error(`[ProviderSynchroniser] failed to enqueue ${kind} mutation for ${id}:`, err);
      this._status$.next(SynchroniserStatus.Error);
    } finally {
      if (this._status$.getValue() === SynchroniserStatus.PushingMutations) {
        this._status$.next(SynchroniserStatus.Idle);
      }
    }
  }

  private async _readRow(kind: ProviderKind, id: string): Promise<ISyncEntityRow | null> {
    if (kind === 'provider') {
      return (await this._providerRepo.getProviderById(id)) ?? null;
    }
    if (kind === 'modelConfig') {
      const all = await this._providerRepo.getAllModelConfigs();
      return all.find((r) => r.id === id) ?? null;
    }
    const customs = await this._providerRepo.getAllCustomModels();
    return customs.find((r) => r.id === id) ?? null;
  }

  private _buildUpsertMutation(kind: ProviderKind, row: ISyncEntityRow, entityId: string, baseVersion: number | null): Omit<ISyncMutation, 'id' | 'createdAt'> {
    const payloadObj: IProviderPayload = { kind, row };
    const json = JSON.stringify(payloadObj);
    const payload = this._cryptoService.encrypt(TEXT_ENCODER.encode(json));
    return {
      resource: RESOURCE_ID,
      op: 'upsert',
      entityId,
      payload,
      baseVersion,
    };
  }

  private async _applyOne(item: ISyncPatchItem): Promise<void> {
    if (item.op === 'clear') {
      const providers = await this._providerRepo.getProviders();
      for (const p of providers) {
        await this._providerRepo.deleteProvider(p.id);
      }
      await this._rowMetaRepo.deleteResource(RESOURCE_ID);
      return;
    }

    if (item.entityId === null) {
      this._logService.warn('[ProviderSynchroniser] patch item missing entityId; skipping');
      return;
    }

    const { kind, id } = this._decodeEntityId(item.entityId);
    if (!kind) {
      this._logService.warn(`[ProviderSynchroniser] unrecognised entityId prefix: ${item.entityId}`);
      return;
    }

    if (item.op === 'del') {
      await this._deleteByKind(kind, id);
      await this._rowMetaRepo.delete(RESOURCE_ID, item.entityId);
      return;
    }

    if (item.op === 'put') {
      if (!item.payload) {
        this._logService.warn(`[ProviderSynchroniser] put without payload for ${item.entityId}`);
        return;
      }
      const decrypted = this._cryptoService.decrypt(item.payload);
      const parsed = JSON.parse(TEXT_DECODER.decode(decrypted)) as IProviderPayload;

      // Defensive: the server must never mismatch entityId.kind and payload.kind.
      if (parsed.kind !== kind) {
        this._logService.warn(`[ProviderSynchroniser] kind mismatch: entityId=${kind}, payload=${parsed.kind}`);
        return;
      }

      await this._upsertByKind(kind, parsed.row);
      await this._rowMetaRepo.upsert({
        resource: RESOURCE_ID,
        entityId: item.entityId,
        version: item.version,
        updatedAt: Date.now(),
      });
    }
  }

  private _decodeEntityId(entityId: string): { kind: ProviderKind | null; id: string } {
    if (entityId.startsWith(KIND_PREFIX.provider)) {
      return { kind: 'provider', id: entityId.slice(KIND_PREFIX.provider.length) };
    }
    if (entityId.startsWith(KIND_PREFIX.modelConfig)) {
      return { kind: 'modelConfig', id: entityId.slice(KIND_PREFIX.modelConfig.length) };
    }
    if (entityId.startsWith(KIND_PREFIX.customModel)) {
      return { kind: 'customModel', id: entityId.slice(KIND_PREFIX.customModel.length) };
    }
    return { kind: null, id: entityId };
  }

  private async _upsertByKind(kind: ProviderKind, row: ISyncEntityRow): Promise<void> {
    if (kind === 'provider') {
      await this._providerRepo.upsertProvider(row);
      return;
    }
    if (kind === 'modelConfig') {
      await this._providerRepo.upsertModelConfig(row);
      return;
    }
    await this._providerRepo.upsertCustomModel(row);
  }

  private async _deleteByKind(kind: ProviderKind, id: string): Promise<void> {
    if (kind === 'provider') {
      await this._providerRepo.deleteProvider(id);
      return;
    }
    if (kind === 'modelConfig') {
      await this._providerRepo.deleteModelConfig(id);
      return;
    }
    await this._providerRepo.deleteCustomModel(id);
  }
}
