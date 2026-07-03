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

import type { IDisposable } from '@termlnk/core';
import type { Observable } from 'rxjs';
import type { SyncResourceId } from '../common/constants';
import type { ISyncMutation, ISyncPatchItem } from '../models/mutation';
import type { SynchroniserStatus } from '../models/state';
import type { IPushAcceptedDetail } from './transport.service';

// One instance per resource type. Owns the changed$ subscription that pushes mutations
// to the outbox and the applyPatch that consumes pulls. Field-level LWW (only `config`)
// is an internal concern of the synchroniser.
export interface ISyncPatchApplyFailure {
  readonly entityId: string | null;
  readonly version: number;
  readonly error: string;
}

export interface ISyncPatchApplyResult {
  readonly failures: ISyncPatchApplyFailure[];
}

export interface IResourceSynchroniser extends IDisposable {
  readonly resourceId: SyncResourceId;
  readonly status$: Observable<SynchroniserStatus>;

  // Begins listening; stays active until dispose().
  start(): void;

  // Apply a batch of patch items; called by SyncService after a successful pull. Decryption
  // and row-/field-level LWW are at the synchroniser's discretion. Per-row failures are
  // collected in the result instead of aborting the batch.
  applyPatch(patch: ISyncPatchItem[]): Promise<ISyncPatchApplyResult>;

  // Encrypt + serialize local changes into mutations. Synchronisers typically drive this
  // via their changed$ subscription.
  buildMutations(): Promise<ISyncMutation[]>;

  // Re-derive initial mutations for every local row (first sync / forceFullResync).
  buildInitialSnapshot(): Promise<ISyncMutation[]>;

  // Called per accepted mutation right after push ack. Synchroniser persists the
  // server-assigned version locally (sync_row_meta for row-level resources, or
  // sync_field_meta for the field-level config resource) so the next buildInitialSnapshot
  // does not re-enqueue the same row and so future _handleLocalChange uses the correct
  // baseVersion. Failures must be swallowed — meta writes are best-effort and a later
  // reconcile pass covers anything that slipped.
  onPushAccepted(detail: IPushAcceptedDetail): Promise<void>;

  // Called by SyncService.enable() right after a full pull (cursor=null) has refreshed the
  // local store with the server's authoritative state. `serverEntityIds` is the set of
  // entityIds the server still holds (`put` patches in the full pull). Any local meta
  // pointing at an entityId not in this set is a "ghost" — typically left behind after a
  // server-side reset or test wipe — and must be cleared so buildInitialSnapshot re-enqueues
  // the local row on the next pass. Failures should be swallowed; reconcile is opportunistic.
  reconcileGhostMeta(serverEntityIds: ReadonlySet<string>): Promise<void>;
}

// Synchroniser factory used by DI registration.
export interface IResourceSynchroniserFactory {
  create(): IResourceSynchroniser;
  readonly resourceId: SyncResourceId;
}
