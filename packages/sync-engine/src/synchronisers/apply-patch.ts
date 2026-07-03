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

import type { ISyncPatchApplyFailure, ISyncPatchApplyResult, ISyncPatchItem, SyncResourceId } from '@termlnk/sync';

// Shared applyPatch loop for every resource synchroniser: route items of the matching
// resource through `applyOne`, collecting per-item failures instead of aborting the batch.
// A single undecryptable row (e.g. ciphertext written under a previous master key) must
// not block the remaining rows; the caller decides whether failures are skippable (normal
// pull) or fatal (rekey pre-flight).
export async function applyPatchItems(
  patch: ISyncPatchItem[],
  resourceId: SyncResourceId,
  applyOne: (item: ISyncPatchItem) => Promise<void>
): Promise<ISyncPatchApplyResult> {
  const failures: ISyncPatchApplyFailure[] = [];
  for (const item of patch) {
    if (item.resource !== resourceId) {
      continue;
    }
    try {
      await applyOne(item);
    } catch (err) {
      failures.push({
        entityId: item.entityId,
        version: item.version,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { failures };
}
