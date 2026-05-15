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

// One instance per resource type. Owns the changed$ subscription that pushes mutations
// to the outbox and the applyPatch that consumes pulls. Field-level LWW (only `config`)
// is an internal concern of the synchroniser.
export interface IResourceSynchroniser extends IDisposable {
  readonly resourceId: SyncResourceId;
  readonly status$: Observable<SynchroniserStatus>;

  // Begins listening; stays active until dispose().
  start(): void;

  // Apply a batch of patch items; called by SyncService after a successful pull. Decryption
  // and row-/field-level LWW are at the synchroniser's discretion.
  applyPatch(patch: ISyncPatchItem[]): Promise<void>;

  // Encrypt + serialize local changes into mutations. Synchronisers typically drive this
  // via their changed$ subscription.
  buildMutations(): Promise<ISyncMutation[]>;

  // Re-derive initial mutations for every local row (first sync / forceFullResync).
  buildInitialSnapshot(): Promise<ISyncMutation[]>;
}

// Synchroniser factory used by DI registration.
export interface IResourceSynchroniserFactory {
  create(): IResourceSynchroniser;
  readonly resourceId: SyncResourceId;
}
