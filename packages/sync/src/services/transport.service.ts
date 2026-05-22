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
import type { ISyncMutation, ISyncPatchItem } from '../models/mutation';
import { createIdentifier } from '@termlnk/core';

export interface IPushRequest {
  readonly clientId: string;
  readonly mutations: readonly ISyncMutation[];
}

export interface IPushAcceptedDetail {
  /** per-client monotonic id, echoes the mutation that produced this row */
  readonly id: number;
  readonly resource: SyncResourceId;
  readonly entityId: string;
  /** server-assigned version after applying this mutation; written to sync_row_meta on ack */
  readonly version: number;
}

export interface IPushResponse {
  /**
   * Legacy field: ids of accepted mutations. New code prefers `acceptedDetails` because
   * it also carries the server-assigned version needed to update sync_row_meta on ack.
   */
  readonly accepted: readonly number[];
  /**
   * Per-mutation acceptance detail with server version. Empty array on servers that
   * predate this field — callers must fall back to `accepted` for ack and skip meta writes.
   */
  readonly acceptedDetails: readonly IPushAcceptedDetail[];
  // Rejected (e.g. baseVersion conflict); the client should pull and retry.
  readonly rejected: readonly { id: number; reason: string }[];
  // Latest global server version; debug/monitoring only.
  readonly lastServerVersion: number;
}

export interface IPullRequest {
  readonly clientId: string;
  readonly resource: SyncResourceId;
  readonly cursor: string | null;
}

export interface IPullResponse {
  readonly cursor: string;
  readonly patch: readonly ISyncPatchItem[];
  // Highest server-acknowledged mutationId for this client; lets the outbox prune.
  readonly lastMutationId: number;
}

// Server-initiated wake-up; carries no payload, only "something changed".
export interface IPokeMessage {
  readonly type: 'poke';
  readonly resource: SyncResourceId;
  // Latest server cursor so the client can skip a no-op pull.
  readonly cursor: string;
}

// Sync transport (HTTP/WebSocket implementation lives in @termlnk/sync-core). Models
// Replicache's push/pull/poke trio: client-initiated push and pull, server-initiated poke.
export interface ISyncTransportService {
  readonly connected$: Observable<boolean>;
  readonly poke$: Observable<IPokeMessage>;

  push(req: IPushRequest): Promise<IPushResponse>;
  pull(req: IPullRequest): Promise<IPullResponse>;

  // Open the WebSocket on enable; close on disable / logout.
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export const ISyncTransportService = createIdentifier<ISyncTransportService>('sync.transport-service');
