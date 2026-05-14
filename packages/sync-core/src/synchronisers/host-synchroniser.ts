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
 * Host synchroniser — row-level LWW, including group nodes.
 *
 * Scope: full `IHostEntity` rows, including `tree` / `pid` / `sort`. The
 * server holds the canonical tree topology; locally we just upsert per row.
 *
 * Security:
 * - `HostRepository.getInfoById` returns **decrypted** credential/proxy
 *   fields. We re-encrypt with sync E2EE for upload; the receiving side
 *   re-encrypts with the local `SecretCipher` on `syncUpsertRow`.
 * - `hostChainIds` validation is **skipped** in the apply path — the source
 *   device already validated, and rejecting locally would keep the two ends
 *   permanently divergent.
 *
 * Cascade delete: `HostRepository.delete` cascades to descendants at the SQL
 * level, so we only enqueue one delete mutation. The receiving side cascades
 * the same way; both ends converge.
 *
 * Known limits:
 * - No topological sort of incoming patches. If the server delivers
 *   `[child, parent]`, the child briefly references a missing parent in
 *   `tree`. There is no FK to fail the write; the next pull repairs it.
 * - `move` events are treated as plain updates (the row's `pid`/`tree` are
 *   already correct in the DB).
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
        // `move` is treated as update — the row's `pid`/`tree`/`sort` already changed.
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
    // Only enqueue rows that have never been synced before — sync_row_meta is upserted on
    // both push.accepted and applyPatch. A pre-existing meta row means the row is already
    // represented on the server (with whatever version meta records), so re-enqueuing would
    // just create redundant outbox traffic on every enable().
    const rows = await this._collectAllHosts();
    const out: ISyncMutation[] = [];
    for (const row of rows) {
      const meta = await this._rowMeta.get(RESOURCE_ID, row.id);
      if (meta) {
        continue;
      }
      const enqueued = await this._outbox.enqueue(this._buildUpsertMutation(row, null));
      out.push(enqueued);
    }
    return out;
  }

  private async _collectAllHosts(): Promise<IHostEntity[]> {
    // Walk the tree → collect every id → fetch each full `IHostEntity`
    // (credential/proxy get decrypted along the way). This is N+1, but it
    // only runs in the snapshot path and host counts are small (typically <100).
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
      // Defensive: the server should never change `id`, but if it does, the
      // patch's `entityId` is the source of truth.
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
