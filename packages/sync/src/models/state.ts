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
}

export interface ISyncStats {
  readonly pendingMutations: number;
  readonly lastSyncedAt: number | null;
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
