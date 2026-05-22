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

import type { SyncResourceId } from '../common/constants';

// Top-level sync state surfaced to the user UI.
export enum SyncState {
  // Either logged out or sync intentionally disabled by the user.
  Disabled = 'disabled',
  Idle = 'idle',
  Syncing = 'syncing',
  // Network unreachable.
  Offline = 'offline',
  // See lastError for details.
  Error = 'error',
}

// Per-resource synchroniser status.
export enum SynchroniserStatus {
  Idle = 'idle',
  PushingMutations = 'pushing',
  PullingPatch = 'pulling',
  ApplyingPatch = 'applying',
  Error = 'error',
  // Local change observed while master key is locked — synchroniser cannot encrypt,
  // so it cannot enqueue. SyncService maps this to ISyncError.code = 'master_key_locked'
  // and pauses the pipeline until the user signs in again.
  CryptoLocked = 'crypto_locked',
}

export interface ISyncStats {
  readonly pendingMutations: number;
  /**
   * Wall-clock of the most recent successful pull (any resource). Tracks "we know what's
   * on the server up to here" — distinct from `lastPushedAt`, which tracks the outbox
   * direction. The UI uses both to decide between "Up to date" (both flowed at least once
   * and outbox is empty) and "Pulled" (only pulled, never pushed).
   */
  readonly lastSyncedAt: number | null;
  /**
   * Wall-clock of the most recent push round where the outbox emptied to zero. null when
   * the device has never observed a clean push since enable() — either because no local
   * change was ever queued, or because every push round still left rows behind.
   */
  readonly lastPushedAt: number | null;
  readonly perResource: Record<SyncResourceId, IResourceSyncStats>;
}

export interface IResourceSyncStats {
  readonly status: SynchroniserStatus;
  readonly pendingCount: number;
  readonly lastSyncedAt: number | null;
  readonly cursor: string | null;
}

export type SyncErrorCode =
  | 'unauthenticated'
  | 'master_key_locked'
  | 'network'
  | 'rate_limited'
  | 'protocol_mismatch'
  | 'cipher_mismatch'
  | 'server_error'
  | 'unknown';

export interface ISyncError {
  code: SyncErrorCode;
  message: string;
  resource?: SyncResourceId;
  // Set when the user must intervene (re-login, re-derive key, etc.).
  requiresUserAction?: boolean;
}
