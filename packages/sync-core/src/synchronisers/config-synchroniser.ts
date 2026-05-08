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

import type { IResourceSynchroniser, ISyncCryptoService, ISyncMutation, ISyncOutboxService, ISyncPatchItem } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import { ILogService, Inject, RxDisposable } from '@termlnk/core';
import { ConfigRepository, SyncFieldMetaRepository } from '@termlnk/database';
import { ISyncCryptoService as ISyncCryptoServiceId, ISyncOutboxService as ISyncOutboxServiceId, SynchroniserStatus } from '@termlnk/sync';
import { BehaviorSubject } from 'rxjs';

const RESOURCE_ID = 'config' as const;
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

/** entityId 编码为 `<key>::<subKey>` 形式——`::` 分隔符让 key 与 subKey 解耦反序列化。 */
const ENTITY_DELIMITER = '::';

interface IFieldPayload {
  readonly value: unknown;
  /** 本地写入时间（epoch ms）——LWW 比较的关键 */
  readonly updatedAt: number;
}

/**
 * Config 同步器（**字段级** LWW）。
 *
 * 与其他 4 个 row-level synchroniser 的本质差异：config.value 是嵌套 JSON，
 * 整行 LWW 会让两台设备相互覆写未变更的 subKey。所以本同步器以 (key, subKey) 为
 * 最小单位，每个字段独立维护时间戳，避免跨设备 subKey 互相吞噬。
 *
 * Push 路径：
 * - subKey 事件 → 一条 mutation
 * - 无 subKey 的 set 事件（整 key 替换）→ 拆成所有现存 subKey 的 mutation
 * - 无 subKey 的 delete 事件（整 key 删除）→ 一条 entityId 末尾空 subKey 的 delete mutation
 *
 * Pull 路径：
 * - decode entityId → (key, subKey)
 * - 比较 payload.updatedAt 与本地 sync_field_meta.updatedAt
 * - 仅当远端更新 → setField/deleteField + 更新 sync_field_meta
 *
 * 不使用 sync_row_meta（那是行级 synchroniser 的）。
 */
export class ConfigSynchroniser extends RxDisposable implements IResourceSynchroniser {
  readonly resourceId = RESOURCE_ID;

  private readonly _status$ = new BehaviorSubject<SynchroniserStatus>(SynchroniserStatus.Idle);
  readonly status$: Observable<SynchroniserStatus> = this._status$.asObservable();

  private _applyingPatch = false;
  private _started = false;

  constructor(
    @Inject(ConfigRepository) private readonly _configRepo: ConfigRepository,
    @Inject(SyncFieldMetaRepository) private readonly _fieldMeta: SyncFieldMetaRepository,
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
      this._configRepo.changed$.subscribe((event) => {
        if (this._applyingPatch) {
          return;
        }
        void this._handleLocalChange(event);
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
    const all = await this._configRepo.getAll();
    const now = Date.now();

    for (const entry of all) {
      const value = entry.value;
      // 平铺成 (key, subKey) 字段对——支持嵌套对象的第一层
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [field, fieldValue] of Object.entries(value as Record<string, unknown>)) {
          const enqueued = await this._enqueueFieldUpsert(entry.key, field, fieldValue, now);
          out.push(enqueued);
        }
      } else {
        // 原始值（字符串、数字、null、数组）：用空 subKey 表示整 key
        const enqueued = await this._enqueueFieldUpsert(entry.key, '', value, now);
        out.push(enqueued);
      }
    }
    return out;
  }

  private async _handleLocalChange(event: { type: 'set' | 'delete'; key: string; subKey?: string }): Promise<void> {
    try {
      this._status$.next(SynchroniserStatus.PushingMutations);
      const now = Date.now();

      if (event.subKey !== undefined) {
        // 字段级事件
        if (event.type === 'set') {
          const value = await this._configRepo.getField(event.key, event.subKey);
          await this._enqueueFieldUpsert(event.key, event.subKey, value, now);
        } else {
          await this._enqueueFieldDelete(event.key, event.subKey, now);
        }
        return;
      }

      // 整 key 事件——拆解
      if (event.type === 'delete') {
        // 整 key 删除：发一个 entityId 末尾为空 subKey 的 delete mutation
        await this._enqueueFieldDelete(event.key, '', now);
        return;
      }

      // 整 key 设值（罕见路径）：把现存 subKey 都重新 push
      const current = await this._configRepo.get(event.key);
      if (current && typeof current === 'object' && !Array.isArray(current)) {
        for (const [field, fieldValue] of Object.entries(current as Record<string, unknown>)) {
          await this._enqueueFieldUpsert(event.key, field, fieldValue, now);
        }
      } else {
        await this._enqueueFieldUpsert(event.key, '', current, now);
      }
    } catch (err) {
      this._logService.error('[ConfigSynchroniser] failed to enqueue mutation:', err);
      this._status$.next(SynchroniserStatus.Error);
    } finally {
      if (this._status$.getValue() === SynchroniserStatus.PushingMutations) {
        this._status$.next(SynchroniserStatus.Idle);
      }
    }
  }

  private async _enqueueFieldUpsert(key: string, subKey: string, value: unknown, updatedAt: number): Promise<ISyncMutation> {
    const entityId = `${key}${ENTITY_DELIMITER}${subKey}`;
    await this._fieldMeta.upsert({
      resource: RESOURCE_ID,
      entityId: key,
      field: subKey,
      updatedAt,
    });

    const payloadObj: IFieldPayload = { value, updatedAt };
    const payload = this._crypto.encrypt(TEXT_ENCODER.encode(JSON.stringify(payloadObj)));
    return this._outbox.enqueue({
      resource: RESOURCE_ID,
      op: 'upsert',
      entityId,
      payload,
      baseVersion: null,
    });
  }

  private async _enqueueFieldDelete(key: string, subKey: string, updatedAt: number): Promise<ISyncMutation> {
    const entityId = `${key}${ENTITY_DELIMITER}${subKey}`;
    await this._fieldMeta.upsert({
      resource: RESOURCE_ID,
      entityId: key,
      field: subKey,
      updatedAt,
    });

    return this._outbox.enqueue({
      resource: RESOURCE_ID,
      op: 'delete',
      entityId,
      payload: null,
      baseVersion: null,
    });
  }

  private async _applyOne(item: ISyncPatchItem): Promise<void> {
    if (item.op === 'clear') {
      const all = await this._configRepo.getAll();
      for (const entry of all) {
        await this._configRepo.delete(entry.key);
      }
      await this._fieldMeta.deleteResource(RESOURCE_ID);
      return;
    }

    if (item.entityId === null) {
      this._logService.warn('[ConfigSynchroniser] patch item missing entityId; skipping');
      return;
    }

    const decoded = this._decodeEntityId(item.entityId);
    if (!decoded) {
      this._logService.warn(`[ConfigSynchroniser] malformed entityId: ${item.entityId}`);
      return;
    }
    const { key, subKey } = decoded;

    if (item.op === 'del') {
      // 字段级删除——只有当远端的 updatedAt（来自 payload，不直接传时回退到 0）较新才生效
      // 但 delete 路径 payload 为 null，无法携带 updatedAt——退化为"无条件应用"
      // 这是字段级 LWW 的边界 case：删除冲突场景下倾向于"删除胜出"
      if (subKey === '') {
        await this._configRepo.delete(key);
        // 清理这个 key 下所有字段元数据
        const fields = await this._fieldMeta.getByEntity(RESOURCE_ID, key);
        for (const f of fields) {
          await this._fieldMeta.delete(RESOURCE_ID, key, f.field);
        }
      } else {
        await this._configRepo.deleteField(key, subKey);
        await this._fieldMeta.delete(RESOURCE_ID, key, subKey);
      }
      return;
    }

    if (item.op === 'put') {
      if (!item.payload) {
        this._logService.warn(`[ConfigSynchroniser] put without payload for ${item.entityId}`);
        return;
      }
      const decrypted = this._crypto.decrypt(item.payload);
      let parsed: IFieldPayload;
      try {
        parsed = JSON.parse(TEXT_DECODER.decode(decrypted)) as IFieldPayload;
      } catch (err) {
        this._logService.warn(`[ConfigSynchroniser] invalid payload JSON for ${item.entityId}:`, err);
        return;
      }

      // 字段级 LWW：仅当远端 updatedAt 比本地 sync_field_meta.updatedAt 严格更新时才应用
      const local = await this._fieldMeta.get(RESOURCE_ID, key, subKey);
      if (local && local.updatedAt >= parsed.updatedAt) {
        // 本地更新——丢弃远端
        return;
      }

      if (subKey === '') {
        await this._configRepo.set(key, parsed.value);
      } else {
        await this._configRepo.setField(key, subKey, parsed.value);
      }
      await this._fieldMeta.upsert({
        resource: RESOURCE_ID,
        entityId: key,
        field: subKey,
        updatedAt: parsed.updatedAt,
      });
    }
  }

  private _decodeEntityId(entityId: string): { key: string; subKey: string } | null {
    const idx = entityId.indexOf(ENTITY_DELIMITER);
    if (idx < 0) {
      return null;
    }
    return {
      key: entityId.slice(0, idx),
      subKey: entityId.slice(idx + ENTITY_DELIMITER.length),
    };
  }
}
