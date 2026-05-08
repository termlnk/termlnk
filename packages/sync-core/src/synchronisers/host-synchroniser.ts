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

import type { IHostEntity } from '@termlnk/database';
import type { IResourceSynchroniser, ISyncCryptoService, ISyncMutation, ISyncOutboxService, ISyncPatchItem } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import { ILogService, Inject, RxDisposable } from '@termlnk/core';
import { HostRepository, SyncRowMetaRepository } from '@termlnk/database';
import { ISyncCryptoService as ISyncCryptoServiceId, ISyncOutboxService as ISyncOutboxServiceId, SynchroniserStatus } from '@termlnk/sync';
import { BehaviorSubject } from 'rxjs';

const RESOURCE_ID = 'host' as const;
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

/**
 * Host 同步器（行级 LWW，含 group 节点）。
 *
 * 同步范围：完整 IHostEntity 行，含 `tree` / `pid` / `sort` 字段——树拓扑在
 * 远端已是合法状态，本地按行 upsert 即可（深度排序仅在 server-side patch 顺序保证）。
 *
 * 安全语义：
 * - HostRepository.getInfoById 返回**已解密**的 credential/proxy，同步层用 sync E2EE
 *   再加密上传；接收端 syncUpsertRow 用本地 SecretCipher 重新加密入库
 * - hostChainIds 校验在同步 apply 路径**跳过**（源设备已校验；本地拒绝会让两端永久分歧）
 *
 * 删除级联：HostRepository.delete 在 SQL 层级联删除所有后代——同步只发一条 delete
 * mutation，接收端的 delete 自然 cascade。两端最终一致。
 *
 * 局限（明示）：
 * - 不做 patch 拓扑排序——若服务端发来 [child, parent] 顺序，child 写入时 parent 暂缺，
 *   tree 字段会暂时悬空；下次 pull 自然修复，无 FK 约束所以不会写入失败
 * - 'move' 事件被视为普通 update（行的 pid/tree 已变）
 */
export class HostSynchroniser extends RxDisposable implements IResourceSynchroniser {
  readonly resourceId = RESOURCE_ID;

  private readonly _status$ = new BehaviorSubject<SynchroniserStatus>(SynchroniserStatus.Idle);
  readonly status$: Observable<SynchroniserStatus> = this._status$.asObservable();

  private _applyingPatch = false;
  private _started = false;

  constructor(
    @Inject(HostRepository) private readonly _hostRepo: HostRepository,
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
      this._hostRepo.changed$.subscribe((event) => {
        if (this._applyingPatch) {
          return;
        }
        // 'move' 事件视为 update — 行的 pid/tree/sort 已变，需要 push
        const t = event.type === 'move' ? 'update' : event.type;
        void this._handleLocalChange(event.id, t);
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
    // getInfoById 是 by-id；getListByPid 只取一层。要拉所有行需要遍历全树。
    // 简单做法：从根开始递归。
    const rows = await this._collectAllHosts();
    const out: ISyncMutation[] = [];
    for (const row of rows) {
      const meta = await this._rowMeta.get(RESOURCE_ID, row.id);
      const enqueued = await this._outbox.enqueue(this._buildUpsertMutation(row, meta?.version ?? null));
      out.push(enqueued);
    }
    return out;
  }

  private async _collectAllHosts(): Promise<IHostEntity[]> {
    // 树结构 → 所有 id → 逐个 getInfoById 取完整 IHostEntity（含 credential / proxy 解密）。
    // N+1 查询，仅 snapshot 路径调用，量级小（典型 <100 主机），可接受。
    const tree = await this._hostRepo.getTree();
    const ids: string[] = [];
    const collectIds = (nodes: typeof tree): void => {
      for (const node of nodes) {
        ids.push(node.id);
        if (node.children?.length) {
          collectIds(node.children);
        }
      }
    };
    collectIds(tree);

    const rows: IHostEntity[] = [];
    for (const id of ids) {
      const row = await this._hostRepo.getInfoById(id);
      if (row) {
        rows.push(row);
      }
    }
    return rows;
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

      const row = await this._hostRepo.getInfoById(id);
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
      this._logService.error(`[HostSynchroniser] failed to enqueue mutation for ${id}:`, err);
      this._status$.next(SynchroniserStatus.Error);
    } finally {
      if (this._status$.getValue() === SynchroniserStatus.PushingMutations) {
        this._status$.next(SynchroniserStatus.Idle);
      }
    }
  }

  private _buildUpsertMutation(row: IHostEntity, baseVersion: number | null): Omit<ISyncMutation, 'id' | 'createdAt'> {
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
      const all = await this._collectAllHosts();
      for (const r of all) {
        await this._hostRepo.delete(r.id);
      }
      await this._rowMeta.deleteResource(RESOURCE_ID);
      return;
    }

    if (item.entityId === null) {
      this._logService.warn('[HostSynchroniser] patch item missing entityId; skipping');
      return;
    }

    if (item.op === 'del') {
      await this._hostRepo.delete(item.entityId);
      await this._rowMeta.delete(RESOURCE_ID, item.entityId);
      return;
    }

    if (item.op === 'put') {
      if (!item.payload) {
        this._logService.warn(`[HostSynchroniser] put without payload for ${item.entityId}`);
        return;
      }
      const decrypted = this._crypto.decrypt(item.payload);
      const row = JSON.parse(TEXT_DECODER.decode(decrypted)) as IHostEntity;
      // 防御：服务端不应改 id，但若改了，以 patch 的 entityId 为准
      const normalised: IHostEntity = { ...row, id: item.entityId };
      await this._hostRepo.syncUpsertRow(normalised);
      await this._rowMeta.upsert({
        resource: RESOURCE_ID,
        entityId: item.entityId,
        version: item.version,
        updatedAt: Date.now(),
      });
    }
  }
}
