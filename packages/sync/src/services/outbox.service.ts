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
import type { SyncResourceId } from '../common/constants';
import type { ISyncMutation } from '../models/mutation';
import { createIdentifier } from '@termlnk/core';

// Pending-mutation queue persisted to the SQLite `sync_outbox` table — accumulates while
// offline, flushes on reconnect. The server is idempotent on (clientId, mutationId), so
// the client only has to keep mutationId monotonic.
export interface ISyncOutboxService {
  readonly pendingCount$: Observable<number>;

  // Call inside the same SQLite transaction that performs the local write so the two
  // commits are atomic.
  enqueue(mutation: Omit<ISyncMutation, 'id' | 'createdAt'>): Promise<ISyncMutation>;

  // FIFO peek; entries stay until ack().
  peek(limit?: number): Promise<ISyncMutation[]>;

  // Server confirmed receipt — drop by mutationId.
  ack(mutationIds: number[]): Promise<void>;

  // Server rejected (e.g. baseVersion conflict) — mark for retry.
  markRejected(mutationIds: number[], reason: string): Promise<void>;

  countByResource(resource: SyncResourceId): Promise<number>;

  // Used by forceFullResync.
  clearResource(resource: SyncResourceId): Promise<void>;

  // Remove rows whose resource matches and entityId starts with any of the given prefixes;
  // returns the deleted count. Used at startup to evict mutations targeting device-specific
  // config keys.
  purgeByEntityIdPrefixes(resource: SyncResourceId, prefixes: readonly string[]): Promise<number>;
}

export const ISyncOutboxService = createIdentifier<ISyncOutboxService>('sync.outbox-service');
