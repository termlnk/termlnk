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
import { ISyncCryptoService as ISyncCryptoServiceId, ISyncOutboxService as ISyncOutboxServiceId, NON_SYNCABLE_CONFIG_KEYS, SynchroniserStatus } from '@termlnk/sync';
import { BehaviorSubject } from 'rxjs';

const RESOURCE_ID = 'config' as const;
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

/** entityId is encoded as `<key>::<subKey>`; the `::` lets us split unambiguously. */
const ENTITY_DELIMITER = '::';

interface IFieldPayload {
  readonly value: unknown;
  /** Local write time (epoch ms) — the LWW comparator. */
  readonly updatedAt: number;
}

/**
 * Config synchroniser — **field-level** LWW.
 *
 * Unlike the four row-level synchronisers, `config.value` is nested JSON. Row
 * LWW would let two devices clobber each other's unrelated subKeys, so the
 * unit of synchronisation is `(key, subKey)` with a per-field timestamp.
 *
 * Push:
 * - subKey event → one mutation
 * - whole-key `set` (no subKey) → fan out one mutation per existing subKey
 * - whole-key `delete` (no subKey) → one delete mutation with empty subKey
 *
 * Pull:
 * - decode entityId → `(key, subKey)`
 * - compare `payload.updatedAt` with local `sync_field_meta.updatedAt`
 * - apply only when the remote is strictly newer
 *
 * Does not use `sync_row_meta` (that is for row-level synchronisers).
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
        // Device-specific plugin config (sync internals, auth tokens, window state, …) must
        // never enter the outbox. Skipping here also breaks the self-referential loop where
        // SyncOutboxService.enqueue persists `sync.config.lastClientMutId`, which would
        // otherwise re-enter this handler and enqueue another mutation ad infinitum.
        if (NON_SYNCABLE_CONFIG_KEYS.has(event.key)) {
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
    // Only enqueue fields without a sync_field_meta record — those are the ones that have
    // never been touched by the sync write path (i.e. existed before the first enable()).
    // _enqueueFieldUpsert already writes the meta as a side effect, so subsequent enable()
    // calls naturally short-circuit here.
    const out: ISyncMutation[] = [];
    const all = await this._configRepo.getAll();
    const now = Date.now();

    for (const entry of all) {
      if (NON_SYNCABLE_CONFIG_KEYS.has(entry.key)) {
        continue;
      }
      const value = entry.value;
      // Flatten to (key, subKey) field pairs — first object level only.
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [field, fieldValue] of Object.entries(value as Record<string, unknown>)) {
          const existingMeta = await this._fieldMeta.get(RESOURCE_ID, entry.key, field);
          if (existingMeta) {
            continue;
          }
          const enqueued = await this._enqueueFieldUpsert(entry.key, field, fieldValue, now);
          out.push(enqueued);
        }
      } else {
        const existingMeta = await this._fieldMeta.get(RESOURCE_ID, entry.key, '');
        if (existingMeta) {
          continue;
        }
        // Primitive value (string / number / null / array): use empty subKey for the whole key.
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
        // Field-level event.
        if (event.type === 'set') {
          const value = await this._configRepo.getField(event.key, event.subKey);
          await this._enqueueFieldUpsert(event.key, event.subKey, value, now);
        } else {
          await this._enqueueFieldDelete(event.key, event.subKey, now);
        }
        return;
      }

      // Whole-key event — fan out.
      if (event.type === 'delete') {
        // Whole-key delete: one mutation with an empty trailing subKey.
        await this._enqueueFieldDelete(event.key, '', now);
        return;
      }

      // Whole-key set (rare): re-push every existing subKey.
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

    // Defense-in-depth: refuse to apply device-specific keys even if the server returned them
    // (older client may have pushed garbage before the outbound filter shipped).
    if (NON_SYNCABLE_CONFIG_KEYS.has(key)) {
      return;
    }

    if (item.op === 'del') {
      // Field-level delete. Ideally we would compare the remote `updatedAt`
      // with the local `sync_field_meta.updatedAt`, but delete payloads are
      // null and cannot carry a timestamp — so we apply unconditionally. This
      // means "delete wins" on conflicts, which is the documented edge case
      // for field-level LWW.
      if (subKey === '') {
        await this._configRepo.delete(key);
        // Drop every field-meta row under this key.
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

      // Field-level LWW: apply only when remote `updatedAt` is strictly newer
      // than local `sync_field_meta.updatedAt`.
      const local = await this._fieldMeta.get(RESOURCE_ID, key, subKey);
      if (local && local.updatedAt >= parsed.updatedAt) {
        // Local wins — drop the remote update.
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
