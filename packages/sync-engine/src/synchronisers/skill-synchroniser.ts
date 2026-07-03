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

import type { IPushAcceptedDetail, IResourceSynchroniser, ISyncMutation, ISyncPatchApplyResult, ISyncPatchItem, ISyncSkillRow } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import { ILogService, RxDisposable } from '@termlnk/core';
import { ISkillSyncRepository, ISyncCryptoService, ISyncOutboxService, ISyncRowMetaRepository, SynchroniserStatus } from '@termlnk/sync';
import { BehaviorSubject } from 'rxjs';
import { applyPatchItems } from './apply-patch';

const RESOURCE_ID = 'skill' as const;
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

// Row-level LWW for ISkillEntity. The skill files themselves are not synced — users
// manage those via git / dotfiles; SkillDiscoveryService repairs `path` on next scan
// and `checksum` lets it decide whether to re-parse. While applyPatch runs we ignore
// changed$ to avoid the self-reflection loop (server pull → local write → push back).
//
// Built-in skills (source === 'builtin') are part of the app binary and re-seeded on
// every boot by SkillDiscoveryService. They must never enter the sync stream — pushing
// them wastes outbox slots and pulling them from another device's binary would clobber
// local rows on the next discovery pass.
export class SkillSynchroniser extends RxDisposable implements IResourceSynchroniser {
  readonly resourceId = RESOURCE_ID;

  private readonly _status$ = new BehaviorSubject<SynchroniserStatus>(SynchroniserStatus.Idle);
  readonly status$: Observable<SynchroniserStatus> = this._status$.asObservable();

  private _applyingPatch = false;
  private _started = false;

  // Cache of built-in skill ids — populated eagerly at start() and maintained from
  // add/update events. Needed because delete events don't carry the source field and
  // the row is already gone by the time we'd try to query it.
  private readonly _builtinIds = new Set<string>();
  private _builtinIdsReady: Promise<void> | null = null;

  constructor(
    @ISkillSyncRepository private readonly _skillRepo: ISkillSyncRepository,
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
    this._builtinIdsReady = this._loadBuiltinIds();
    this.disposeWithMe(
      this._skillRepo.changed$.subscribe((event) => {
        if (this._applyingPatch) {
          return;
        }
        void this._handleLocalChange(event.id, event.type);
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
        this._logService.log(`[SkillSynchroniser] dropping ghost meta for ${meta.entityId}`);
        await this._rowMetaRepo.delete(RESOURCE_ID, meta.entityId);
      }
    }
  }

  async buildInitialSnapshot(): Promise<ISyncMutation[]> {
    // Skip rows that already have sync_row_meta so re-enable() never re-pushes.
    const rows = await this._skillRepo.getAll();
    const out: ISyncMutation[] = [];
    for (const row of rows) {
      if (row.source === 'builtin') {
        this._builtinIds.add(row.id);
        continue;
      }
      const meta = await this._rowMetaRepo.get(RESOURCE_ID, row.id);
      if (meta) {
        continue;
      }
      const mutation = await this._buildUpsertMutation(row, null);
      const enqueued = await this._outboxService.enqueue(mutation);
      out.push(enqueued);
    }
    return out;
  }

  private async _loadBuiltinIds(): Promise<void> {
    try {
      const rows = await this._skillRepo.getAll();
      for (const row of rows) {
        if (row.source === 'builtin') {
          this._builtinIds.add(row.id);
        }
      }
    } catch (err) {
      this._logService.warn('[SkillSynchroniser] failed to seed built-in id cache:', err);
    }
  }

  private async _handleLocalChange(id: string, type: 'add' | 'update' | 'delete'): Promise<void> {
    try {
      if (this._builtinIdsReady) {
        await this._builtinIdsReady;
      }
      this._status$.next(SynchroniserStatus.PushingMutations);

      if (type === 'delete') {
        if (this._builtinIds.delete(id)) {
          return;
        }
        const meta = await this._rowMetaRepo.get(RESOURCE_ID, id);
        await this._outboxService.enqueue({
          resource: RESOURCE_ID,
          op: 'delete',
          entityId: id,
          payload: null,
          baseVersion: meta?.version ?? null,
        });
        return;
      }

      const row = await this._skillRepo.getById(id);
      if (!row) {
        // Race: the row was deleted before the event reached us. Fall back to a delete
        // mutation, unless the cache says this was a built-in row (never on the server).
        if (this._builtinIds.delete(id)) {
          return;
        }
        const meta = await this._rowMetaRepo.get(RESOURCE_ID, id);
        await this._outboxService.enqueue({
          resource: RESOURCE_ID,
          op: 'delete',
          entityId: id,
          payload: null,
          baseVersion: meta?.version ?? null,
        });
        return;
      }

      if (row.source === 'builtin') {
        this._builtinIds.add(id);
        return;
      }
      // Defensive: ensure a previously-built-in id can be re-classified if discovery
      // ever moves a skill between sources (no current path does, but cheap to guard).
      this._builtinIds.delete(id);

      const meta = await this._rowMetaRepo.get(RESOURCE_ID, id);
      const mutation = await this._buildUpsertMutation(row, meta?.version ?? null);
      await this._outboxService.enqueue(mutation);
    } catch (err) {
      if (!this._cryptoService.available) {
        this._status$.next(SynchroniserStatus.CryptoLocked);
        return;
      }
      this._logService.error(`[SkillSynchroniser] failed to enqueue mutation for ${id}:`, err);
      this._status$.next(SynchroniserStatus.Error);
    } finally {
      if (this._status$.getValue() === SynchroniserStatus.PushingMutations) {
        this._status$.next(SynchroniserStatus.Idle);
      }
    }
  }

  private async _buildUpsertMutation(row: ISyncSkillRow, baseVersion: number | null): Promise<Omit<ISyncMutation, 'id' | 'createdAt'>> {
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
      const rows = await this._skillRepo.getAll();
      for (const r of rows) {
        if (r.source === 'builtin') {
          // Built-in skills never lived on the server, so a server-driven clear must not
          // wipe them locally. Remember the id either way to keep the cache consistent.
          this._builtinIds.add(r.id);
          continue;
        }
        await this._skillRepo.delete(r.id);
        await this._rowMetaRepo.delete(RESOURCE_ID, r.id);
      }
      return;
    }

    if (item.entityId === null) {
      this._logService.warn('[SkillSynchroniser] patch item missing entityId; skipping');
      return;
    }

    if (item.op === 'del') {
      // Defensive: a stale server entry could try to delete a row that locally is built-in.
      if (this._builtinIds.has(item.entityId)) {
        return;
      }
      const local = await this._skillRepo.getById(item.entityId);
      if (local && local.source === 'builtin') {
        this._builtinIds.add(item.entityId);
        return;
      }
      await this._skillRepo.delete(item.entityId);
      await this._rowMetaRepo.delete(RESOURCE_ID, item.entityId);
      return;
    }

    if (item.op === 'put') {
      if (!item.payload) {
        this._logService.warn(`[SkillSynchroniser] put without payload for ${item.entityId}`);
        return;
      }
      const decrypted = this._cryptoService.decrypt(item.payload);
      const row = JSON.parse(TEXT_DECODER.decode(decrypted)) as ISyncSkillRow;
      // Refuse to write a built-in row pulled from the server — those belong to the binary,
      // not to user data. This also catches the case where an older client pushed a
      // built-in row before this filter existed.
      if (row.source === 'builtin') {
        return;
      }
      // entityId is the source of truth if payload.id ever drifts.
      const normalised: ISyncSkillRow = { ...row, id: item.entityId };
      await this._skillRepo.upsert(normalised);
      await this._rowMetaRepo.upsert({
        resource: RESOURCE_ID,
        entityId: item.entityId,
        version: item.version,
        updatedAt: Date.now(),
      });
    }
  }
}
