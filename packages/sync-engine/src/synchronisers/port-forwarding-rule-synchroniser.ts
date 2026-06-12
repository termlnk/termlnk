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

import type { IPushAcceptedDetail, IResourceSynchroniser, ISyncEntityRow, ISyncMutation, ISyncPatchItem } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import { ILogService, RxDisposable } from '@termlnk/core';
import { IPortForwardingRuleSyncRepository, ISyncCryptoService, ISyncOutboxService, ISyncRowMetaRepository, SynchroniserStatus } from '@termlnk/sync';
import { BehaviorSubject } from 'rxjs';

const RESOURCE_ID = 'port_forwarding_rule' as const;
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

// Row-level LWW for port_forwarding_rule. Rules are plain config rows (no
// runtime state, no secrets in the row itself) but the payload still travels
// E2EE because `destinationAddress` may reveal internal network topology.
export class PortForwardingRuleSynchroniser extends RxDisposable implements IResourceSynchroniser {
  readonly resourceId = RESOURCE_ID;

  private readonly _status$ = new BehaviorSubject<SynchroniserStatus>(SynchroniserStatus.Idle);
  readonly status$: Observable<SynchroniserStatus> = this._status$.asObservable();

  private _applyingPatch = false;
  private _started = false;

  constructor(
    @IPortForwardingRuleSyncRepository private readonly _repo: IPortForwardingRuleSyncRepository,
    @ISyncRowMetaRepository private readonly _rowMetaRepo: ISyncRowMetaRepository,
    @ISyncOutboxService private readonly _outboxService: ISyncOutboxService,
    @ISyncCryptoService private readonly _cryptoService: ISyncCryptoService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  override dispose(): void {
    super.dispose();
    this._status$.complete();
  }

  start(): void {
    if (this._started) {
      return;
    }
    this._started = true;
    this.disposeWithMe(
      this._repo.changed$.subscribe((event) => {
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

  async onPushAccepted(detail: IPushAcceptedDetail): Promise<void> {
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
        this._logService.log(`[PortForwardingRuleSynchroniser] dropping ghost meta for ${meta.entityId}`);
        await this._rowMetaRepo.delete(RESOURCE_ID, meta.entityId);
      }
    }
  }

  async buildInitialSnapshot(): Promise<ISyncMutation[]> {
    const rows = await this._repo.getList();
    const out: ISyncMutation[] = [];
    for (const row of rows) {
      const meta = await this._rowMetaRepo.get(RESOURCE_ID, row.id);
      if (meta) {
        continue;
      }
      const enqueued = await this._outboxService.enqueue(this._buildUpsertMutation(row, null));
      out.push(enqueued);
    }
    return out;
  }

  private async _handleLocalChange(id: string, type: 'add' | 'update' | 'delete'): Promise<void> {
    try {
      this._status$.next(SynchroniserStatus.PushingMutations);
      const meta = await this._rowMetaRepo.get(RESOURCE_ID, id);
      const baseVersion = meta?.version ?? null;

      if (type === 'delete') {
        await this._outboxService.enqueue({
          resource: RESOURCE_ID,
          op: 'delete',
          entityId: id,
          payload: null,
          baseVersion,
        });
        return;
      }

      const row = await this._repo.getById(id);
      if (!row) {
        await this._outboxService.enqueue({
          resource: RESOURCE_ID,
          op: 'delete',
          entityId: id,
          payload: null,
          baseVersion,
        });
        return;
      }

      await this._outboxService.enqueue(this._buildUpsertMutation(row, baseVersion));
    } catch (err) {
      if (!this._cryptoService.available) {
        this._status$.next(SynchroniserStatus.CryptoLocked);
        return;
      }
      this._logService.error(`[PortForwardingRuleSynchroniser] failed to enqueue mutation for ${id}:`, err);
      this._status$.next(SynchroniserStatus.Error);
    } finally {
      if (this._status$.getValue() === SynchroniserStatus.PushingMutations) {
        this._status$.next(SynchroniserStatus.Idle);
      }
    }
  }

  private _buildUpsertMutation(row: ISyncEntityRow, baseVersion: number | null): Omit<ISyncMutation, 'id' | 'createdAt'> {
    const json = JSON.stringify(row);
    const payload = this._cryptoService.encrypt(TEXT_ENCODER.encode(json));
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
      const all = await this._repo.getList();
      for (const r of all) {
        await this._repo.delete(r.id);
      }
      await this._rowMetaRepo.deleteResource(RESOURCE_ID);
      return;
    }

    if (item.entityId === null) {
      this._logService.warn('[PortForwardingRuleSynchroniser] patch item missing entityId; skipping');
      return;
    }

    if (item.op === 'del') {
      await this._repo.delete(item.entityId);
      await this._rowMetaRepo.delete(RESOURCE_ID, item.entityId);
      return;
    }

    if (item.op === 'put') {
      if (!item.payload) {
        this._logService.warn(`[PortForwardingRuleSynchroniser] put without payload for ${item.entityId}`);
        return;
      }
      const decrypted = this._cryptoService.decrypt(item.payload);
      const row = JSON.parse(TEXT_DECODER.decode(decrypted)) as ISyncEntityRow;
      const normalised: ISyncEntityRow = { ...row, id: item.entityId };
      await this._repo.syncUpsertRow(normalised);
      await this._rowMetaRepo.upsert({
        resource: RESOURCE_ID,
        entityId: item.entityId,
        version: item.version,
        updatedAt: Date.now(),
      });
    }
  }
}
