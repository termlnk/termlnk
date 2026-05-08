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

import type { IAICustomModelEntity, IAIProviderEntity, IAIProviderModelEntity } from '@termlnk/database';
import type { IResourceSynchroniser, ISyncCryptoService, ISyncMutation, ISyncOutboxService, ISyncPatchItem } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import { ILogService, Inject, RxDisposable } from '@termlnk/core';
import { ProviderRepository, SyncRowMetaRepository } from '@termlnk/database';
import { ISyncCryptoService as ISyncCryptoServiceId, ISyncOutboxService as ISyncOutboxServiceId, SynchroniserStatus } from '@termlnk/sync';
import { BehaviorSubject } from 'rxjs';

const RESOURCE_ID = 'ai_provider' as const;
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

/**
 * EntityId 命名空间前缀——把 3 张关联表（provider / model_config / custom_model）
 * 映射到同一个 `ai_provider` 资源 ID 下，避免 SyncResourceId 列表膨胀。
 */
const KIND_PREFIX = {
  provider: 'prov:',
  modelConfig: 'pmod:',
  customModel: 'cmod:',
} as const;

type ProviderKind = keyof typeof KIND_PREFIX;

interface IProviderPayload {
  readonly kind: ProviderKind;
  readonly row: IAIProviderEntity | IAIProviderModelEntity | IAICustomModelEntity;
}

/**
 * AI Provider 同步器（行级 LWW 跨 3 张关联表）。
 *
 * 同步范围：
 * - `ai_provider` (Provider 主表)，apiKey 经 Repository 透明解密上 wire（再被 sync E2EE 包裹）
 * - `ai_provider_model` (内置模型 enabled/overrides 增量)
 * - `ai_custom_model` (用户自定义模型完整定义)
 *
 * 一条 mutation 对应一行——三张表的 entityId 加 `prov:` / `pmod:` / `cmod:` 前缀
 * 区分子表，applyPatch 按前缀分发到对应 Repository upsert。
 *
 * 级联删除：本地 `deleteProvider` 会在 SQL 层 cascade 子表，但只发出一个 'provider' delete
 * 事件——同步层不试图重建子表 delete 列表（这要扫旧状态成本高），改让接收端的
 * `deleteProvider` 自己执行同样的 cascade。两端最终一致。
 */
export class ProviderSynchroniser extends RxDisposable implements IResourceSynchroniser {
  readonly resourceId = RESOURCE_ID;

  private readonly _status$ = new BehaviorSubject<SynchroniserStatus>(SynchroniserStatus.Idle);
  readonly status$: Observable<SynchroniserStatus> = this._status$.asObservable();

  private _applyingPatch = false;
  private _started = false;

  constructor(
    @Inject(ProviderRepository) private readonly _providerRepo: ProviderRepository,
    @Inject(SyncRowMetaRepository) private readonly _rowMeta: SyncRowMetaRepository,
    @Inject(ISyncOutboxServiceId) private readonly _outbox: ISyncOutboxService,
    @Inject(ISyncCryptoServiceId) private readonly _crypto: ISyncCryptoService,
    @Inject(ILogService) private readonly _logService: ILogService
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

  async applyPatch(patch: ISyncPatchItem[]): Promise<void> {
    if (patch.length === 0) {
      return;
    }
    this._status$.next(SynchroniserStatus.ApplyingPatch);
    this._applyingPatch = true;
    try {
      for (const item of patch) {
        if (item.resource !== RESOURCE_ID) {
          continue;
        }
        await this._applyOne(item);
      }
    } finally {
      this._applyingPatch = false;
      this._status$.next(SynchroniserStatus.Idle);
    }
  }

  async buildMutations(): Promise<ISyncMutation[]> {
    return [];
  }

  async buildInitialSnapshot(): Promise<ISyncMutation[]> {
    const out: ISyncMutation[] = [];

    const providers = await this._providerRepo.getProviders();
    for (const row of providers) {
      out.push(await this._enqueueUpsert('provider', row, row.id));
    }

    const modelConfigs = await this._providerRepo.getAllModelConfigs();
    for (const row of modelConfigs) {
      out.push(await this._enqueueUpsert('modelConfig', row, row.id));
    }

    const customModels = await this._providerRepo.getAllCustomModels();
    for (const row of customModels) {
      out.push(await this._enqueueUpsert('customModel', row, row.id));
    }

    return out;
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
      const meta = await this._rowMeta.get(RESOURCE_ID, entityId);
      const baseVersion = meta?.version ?? null;

      if (action === 'delete') {
        await this._outbox.enqueue({
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
        await this._outbox.enqueue({
          resource: RESOURCE_ID,
          op: 'delete',
          entityId,
          payload: null,
          baseVersion,
        });
        return;
      }

      await this._outbox.enqueue(this._buildUpsertMutation(kind, row, entityId, baseVersion));
    } catch (err) {
      this._logService.error(`[ProviderSynchroniser] failed to enqueue ${kind} mutation for ${id}:`, err);
      this._status$.next(SynchroniserStatus.Error);
    } finally {
      if (this._status$.getValue() === SynchroniserStatus.PushingMutations) {
        this._status$.next(SynchroniserStatus.Idle);
      }
    }
  }

  private async _readRow(kind: ProviderKind, id: string): Promise<IAIProviderEntity | IAIProviderModelEntity | IAICustomModelEntity | null> {
    if (kind === 'provider') {
      return this._providerRepo.getProviderById(id);
    }
    if (kind === 'modelConfig') {
      const all = await this._providerRepo.getAllModelConfigs();
      return all.find((r) => r.id === id) ?? null;
    }
    const customs = await this._providerRepo.getAllCustomModels();
    return customs.find((r) => r.id === id) ?? null;
  }

  private async _enqueueUpsert(kind: ProviderKind, row: IAIProviderEntity | IAIProviderModelEntity | IAICustomModelEntity, id: string): Promise<ISyncMutation> {
    const entityId = `${KIND_PREFIX[kind]}${id}`;
    const meta = await this._rowMeta.get(RESOURCE_ID, entityId);
    return this._outbox.enqueue(this._buildUpsertMutation(kind, row, entityId, meta?.version ?? null));
  }

  private _buildUpsertMutation(kind: ProviderKind, row: IAIProviderEntity | IAIProviderModelEntity | IAICustomModelEntity, entityId: string, baseVersion: number | null): Omit<ISyncMutation, 'id' | 'createdAt'> {
    const payloadObj: IProviderPayload = { kind, row };
    const json = JSON.stringify(payloadObj);
    const payload = this._crypto.encrypt(TEXT_ENCODER.encode(json));
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
      // 全量重置：所有 provider + 关联表
      const providers = await this._providerRepo.getProviders();
      for (const p of providers) {
        await this._providerRepo.deleteProvider(p.id);
      }
      await this._rowMeta.deleteResource(RESOURCE_ID);
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
      await this._rowMeta.delete(RESOURCE_ID, item.entityId);
      return;
    }

    if (item.op === 'put') {
      if (!item.payload) {
        this._logService.warn(`[ProviderSynchroniser] put without payload for ${item.entityId}`);
        return;
      }
      const decrypted = this._crypto.decrypt(item.payload);
      const parsed = JSON.parse(TEXT_DECODER.decode(decrypted)) as IProviderPayload;

      // 防御：服务端不应把 entityId.kind 与 payload.kind 错配
      if (parsed.kind !== kind) {
        this._logService.warn(`[ProviderSynchroniser] kind mismatch: entityId=${kind}, payload=${parsed.kind}`);
        return;
      }

      await this._upsertByKind(kind, parsed.row);
      await this._rowMeta.upsert({
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

  private async _upsertByKind(kind: ProviderKind, row: IAIProviderEntity | IAIProviderModelEntity | IAICustomModelEntity): Promise<void> {
    if (kind === 'provider') {
      await this._providerRepo.upsertProvider(row as IAIProviderEntity);
      return;
    }
    if (kind === 'modelConfig') {
      await this._providerRepo.upsertModelConfig(row as IAIProviderModelEntity);
      return;
    }
    await this._providerRepo.upsertCustomModel(row as IAICustomModelEntity);
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
