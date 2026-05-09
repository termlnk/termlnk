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

import type { Observable } from 'rxjs';
import type { ISyncError, ISyncStats, SyncState } from '../models/state';
import { createIdentifier } from '@termlnk/core';

// Top-level sync coordinator (main-process only). Registers ResourceSynchronisers, manages
// the global sync lifecycle, drives push/pull cadence (debounce + poll + poke) and exposes
// state for the renderer via tRPC subscriptions.
//
// Out of scope: payload decryption (handled per-synchroniser), SQLite merging (per-synchroniser
// via Repositories), token management (IAuthService — the transport interceptor pulls them in).
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
}

export const ISyncService = createIdentifier<ISyncService>('sync.sync-service');
