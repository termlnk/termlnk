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

import type { ISkillEntity } from '@termlnk/database';
import type { IResourceSynchroniser, ISyncCryptoService, ISyncMutation, ISyncOutboxService, ISyncPatchItem } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import { ILogService, Inject, RxDisposable } from '@termlnk/core';
import { SkillRepository, SyncRowMetaRepository } from '@termlnk/database';
import { ISyncCryptoService as ISyncCryptoServiceId, ISyncOutboxService as ISyncOutboxServiceId, SynchroniserStatus } from '@termlnk/sync';
import { BehaviorSubject } from 'rxjs';

const RESOURCE_ID = 'skill' as const;
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

// Row-level LWW for ISkillEntity. The skill files themselves are not synced — users
// manage those via git / dotfiles; SkillDiscoveryService repairs `path` on next scan
// and `checksum` lets it decide whether to re-parse. While applyPatch runs we ignore
// changed$ to avoid the self-reflection loop (server pull → local write → push back).
export class SkillSynchroniser extends RxDisposable implements IResourceSynchroniser {
  readonly resourceId = RESOURCE_ID;

  private readonly _status$ = new BehaviorSubject<SynchroniserStatus>(SynchroniserStatus.Idle);
  readonly status$: Observable<SynchroniserStatus> = this._status$.asObservable();

  private _applyingPatch = false;
  private _started = false;

  constructor(
    @Inject(SkillRepository) private readonly _skillRepo: SkillRepository,
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
      this._skillRepo.changed$.subscribe((event) => {
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
    // Skip rows that already have sync_row_meta so re-enable() never re-pushes.
    const rows = await this._skillRepo.getAll();
    const out: ISyncMutation[] = [];
    for (const row of rows) {
      const meta = await this._rowMeta.get(RESOURCE_ID, row.id);
      if (meta) {
        continue;
      }
      const mutation = await this._buildUpsertMutation(row, null);
      const enqueued = await this._outbox.enqueue(mutation);
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

      const row = await this._skillRepo.getById(id);
      if (!row) {
        // Race: the row was deleted before the event reached us — fall back to a delete mutation.
        await this._outbox.enqueue({
          resource: RESOURCE_ID,
          op: 'delete',
          entityId: id,
          payload: null,
          baseVersion,
        });
        return;
      }

      const mutation = await this._buildUpsertMutation(row, baseVersion);
      await this._outbox.enqueue(mutation);
    } catch (err) {
      this._logService.error(`[SkillSynchroniser] failed to enqueue mutation for ${id}:`, err);
      this._status$.next(SynchroniserStatus.Error);
    } finally {
      if (this._status$.getValue() === SynchroniserStatus.PushingMutations) {
        this._status$.next(SynchroniserStatus.Idle);
      }
    }
  }

  private async _buildUpsertMutation(row: ISkillEntity, baseVersion: number | null): Promise<Omit<ISyncMutation, 'id' | 'createdAt'>> {
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
      const rows = await this._skillRepo.getAll();
      for (const r of rows) {
        await this._skillRepo.delete(r.id);
        await this._rowMeta.delete(RESOURCE_ID, r.id);
      }
      return;
    }

    if (item.entityId === null) {
      this._logService.warn('[SkillSynchroniser] patch item missing entityId; skipping');
      return;
    }

    if (item.op === 'del') {
      await this._skillRepo.delete(item.entityId);
      await this._rowMeta.delete(RESOURCE_ID, item.entityId);
      return;
    }

    if (item.op === 'put') {
      if (!item.payload) {
        this._logService.warn(`[SkillSynchroniser] put without payload for ${item.entityId}`);
        return;
      }
      const decrypted = this._crypto.decrypt(item.payload);
      const row = JSON.parse(TEXT_DECODER.decode(decrypted)) as ISkillEntity;
      // entityId is the source of truth if payload.id ever drifts.
      const normalised: ISkillEntity = { ...row, id: item.entityId };
      await this._skillRepo.upsert(normalised);
      await this._rowMeta.upsert({
        resource: RESOURCE_ID,
        entityId: item.entityId,
        version: item.version,
        updatedAt: Date.now(),
      });
    }
  }
}
