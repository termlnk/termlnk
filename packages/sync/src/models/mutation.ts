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

// Local mutation queued for upload, modeled on Replicache's Row Version Strategy:
// the client mutationId is monotonic, the server dedupes via (clientId, mutationId), and
// baseVersion drives optimistic concurrency. `payload` is XChaCha20-Poly1305 ciphertext —
// the server stores it zero-knowledge.
export interface ISyncMutation {
  // Per-device monotonic counter; the server uses this for deduplication.
  readonly id: number;
  readonly resource: SyncResourceId;
  readonly op: 'upsert' | 'delete';
  readonly entityId: string;
  // Encrypted; null on delete.
  readonly payload: Uint8Array | null;
  // Server-assigned version that this client observed at write time; null on first create.
  readonly baseVersion: number | null;
  readonly createdAt: number;
}

// Patch item returned by the server pull endpoint, mirroring Replicache's pull response shape.
export interface ISyncPatchItem {
  readonly op: 'put' | 'del' | 'clear';
  readonly resource: SyncResourceId;
  // Null for `clear`.
  readonly entityId: string | null;
  // Encrypted; null for `del`/`clear`.
  readonly payload: Uint8Array | null;
  // Server-assigned monotonic version.
  readonly version: number;
}

// Field-level metadata, used only for the config table whose `value` is nested JSON.
// Row-level resources rely on sync_row_meta instead.
export interface ISyncFieldMeta {
  readonly resource: SyncResourceId;
  readonly entityId: string;
  readonly field: string;
  readonly updatedAt: number;
}

// Locally observed server cursor. The server computes the patch list from this cursor
// (see Replicache's Client View Record).
export interface ISyncCursor {
  readonly resource: SyncResourceId;
  // Opaque server token (base64); the client never inspects its contents.
  readonly value: string;
  readonly lastPulledAt: number;
}
