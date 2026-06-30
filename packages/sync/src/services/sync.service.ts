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
import type { ISyncError, ISyncStats, SyncState } from '../models/state';
import type { IResourceSynchroniser } from './resource-synchroniser';
import { createIdentifier } from '@termlnk/core';

// Top-level sync coordinator. The renderer facade in @termlnk/rpc-client implements the
// same interface but throws on register / stopRuntime — those carry main-process
// semantics and have no IPC surface.
export interface ISyncService {
  readonly state$: Observable<SyncState>;
  readonly stats$: Observable<ISyncStats>;
  readonly lastError$: Observable<ISyncError | null>;

  // True when the user is logged in AND has chosen sync on.
  readonly enabled$: Observable<boolean>;

  // Verifies auth + master-key state, registers synchronisers, performs an initial pull.
  enable(): Promise<void>;

  // Stops synchronisers but keeps local data and the outbox; re-enabling resumes from there.
  disable(): Promise<void>;

  // Manual trigger outside the debounce / poke cadence.
  syncNow(): Promise<void>;

  // Clears cursors and pulls everything from scratch. Useful for cross-device first login or
  // suspected local corruption.
  forceFullResync(): Promise<void>;

  register(synchroniser: IResourceSynchroniser): IDisposable;

  // Re-encrypt all synced data after a password change. Stops the runtime, clears all
  // sync state (row/field meta, cursors, outbox), and re-enables — triggering a full
  // re-push of local data encrypted with the new master key.
  rekeyAndResync(): Promise<void>;

  // Sign-out path: tear down the runtime pipeline without flipping the persisted
  // userEnabled flag, so the next sign-in restores the toggle.
  stopRuntime(): Promise<void>;
}

export const ISyncService = createIdentifier<ISyncService>('sync.sync-service');
