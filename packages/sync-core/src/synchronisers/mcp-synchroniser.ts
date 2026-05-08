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

import type { IMcpServerEntity } from '@termlnk/database';
import type { IResourceSynchroniser, ISyncCryptoService, ISyncMutation, ISyncOutboxService, ISyncPatchItem } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import { ILogService, Inject, RxDisposable } from '@termlnk/core';
import { McpServerRepository, SyncRowMetaRepository } from '@termlnk/database';
import { ISyncCryptoService as ISyncCryptoServiceId, ISyncOutboxService as ISyncOutboxServiceId, SynchroniserStatus } from '@termlnk/sync';
import { BehaviorSubject } from 'rxjs';

const RESOURCE_ID = 'mcp_server' as const;
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

/**
 * MCP Server 同步器（行级 LWW）。
 *
 * 同步范围：完整 IMcpServerEntity 行。
 * - `config` 内的敏感字段（stdio.env / http.headers value）在读取时已被
 *   McpServerRepository 透明解密——同步器看到的是明文，再用 sync E2EE master key
 *   重新加密上传，接收端 upsert 时 Repository 会用本地 SecretCipher 重新加密入库
 * - **不同步** `mcp_oauth_token`（每设备各自重新走 OAuth flow）
 * - 接收端 `status` / `lastError` 等运行时字段会被 patch 覆盖——这是预期行为，
 *   下次连接时 MCPClientService 会写回真实状态
 */
export class McpSynchroniser extends RxDisposable implements IResourceSynchroniser {
  readonly resourceId = RESOURCE_ID;

  private readonly _status$ = new BehaviorSubject<SynchroniserStatus>(SynchroniserStatus.Idle);
  readonly status$: Observable<SynchroniserStatus> = this._status$.asObservable();

  private _applyingPatch = false;
  private _started = false;

  constructor(
    @Inject(McpServerRepository) private readonly _mcpRepo: McpServerRepository,
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
      this._mcpRepo.changed$.subscribe((event) => {
        if (this._applyingPatch) {
          return;
        }
        void this._handleLocalChange(event.id, event.type);
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
    const rows = await this._mcpRepo.getAll();
    const out: ISyncMutation[] = [];
    for (const row of rows) {
      const meta = await this._rowMeta.get(RESOURCE_ID, row.id);
      const enqueued = await this._outbox.enqueue(this._buildUpsertMutation(row, meta?.version ?? null));
      out.push(enqueued);
    }
    return out;
  }

  private async _handleLocalChange(id: string, type: 'add' | 'update' | 'delete'): Promise<void> {
    try {
      this._status$.next(SynchroniserStatus.PushingMutations);
      const meta = await this._rowMeta.get(RESOURCE_ID, id);
      const baseVersion = meta?.version ?? null;

      if (type === 'delete') {
        await this._outbox.enqueue({
          resource: RESOURCE_ID,
          op: 'delete',
          entityId: id,
          payload: null,
          baseVersion,
        });
        return;
      }

      const row = await this._mcpRepo.getById(id);
      if (!row) {
        await this._outbox.enqueue({
          resource: RESOURCE_ID,
          op: 'delete',
          entityId: id,
          payload: null,
          baseVersion,
        });
        return;
      }

      await this._outbox.enqueue(this._buildUpsertMutation(row, baseVersion));
    } catch (err) {
      this._logService.error(`[McpSynchroniser] failed to enqueue mutation for ${id}:`, err);
      this._status$.next(SynchroniserStatus.Error);
    } finally {
      if (this._status$.getValue() === SynchroniserStatus.PushingMutations) {
        this._status$.next(SynchroniserStatus.Idle);
      }
    }
  }

  private _buildUpsertMutation(row: IMcpServerEntity, baseVersion: number | null): Omit<ISyncMutation, 'id' | 'createdAt'> {
    const json = JSON.stringify(row);
    const payload = this._crypto.encrypt(TEXT_ENCODER.encode(json));
    return {
      resource: RESOURCE_ID,
      op: 'upsert',
      entityId: row.id,
      payload,
      baseVersion,
    };
  }

  private async _applyOne(item: ISyncPatchItem): Promise<void> {
    if (item.op === 'clear') {
      const all = await this._mcpRepo.getAll();
      for (const r of all) {
        await this._mcpRepo.delete(r.id);
        await this._rowMeta.delete(RESOURCE_ID, r.id);
      }
      return;
    }

    if (item.entityId === null) {
      this._logService.warn('[McpSynchroniser] patch item missing entityId; skipping');
      return;
    }

    if (item.op === 'del') {
      await this._mcpRepo.delete(item.entityId);
      await this._rowMeta.delete(RESOURCE_ID, item.entityId);
      return;
    }

    if (item.op === 'put') {
      if (!item.payload) {
        this._logService.warn(`[McpSynchroniser] put without payload for ${item.entityId}`);
        return;
      }
      const decrypted = this._crypto.decrypt(item.payload);
      const row = JSON.parse(TEXT_DECODER.decode(decrypted)) as IMcpServerEntity;

      const existing = await this._mcpRepo.getById(item.entityId);
      if (existing) {
        // 更新除 id 外的所有字段；Repository 会重新加密 config 内的敏感字段
        const { id: _id, ...rest } = row;
        await this._mcpRepo.update(item.entityId, rest);
      } else {
        await this._mcpRepo.create({ ...row, id: item.entityId });
      }

      await this._rowMeta.upsert({
        resource: RESOURCE_ID,
        entityId: item.entityId,
        version: item.version,
        updatedAt: Date.now(),
      });
    }
  }
}
