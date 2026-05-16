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

import { createIdentifier } from '@termlnk/core';

// Key/value storage abstraction for auth-core's persistent state (token pairs, recovery
// blobs, anything that must survive a restart but never cross IPC). The contract is
// deliberately minimal — no iteration, prefix queries, or atomic multi-write semantics.
// Implementations own whatever encryption their platform requires and treat the storage
// as opaque to auth-core.
export interface IAuthKeyValueStorage {
  // Returns null when the key is absent. Implementations MUST NOT return an empty string
  // as a synonym for "missing"; downstream JSON.parse('') would throw.
  getString(key: string): Promise<string | null>;
  setString(key: string, value: string): Promise<void>;
  deleteKey(key: string): Promise<void>;
}

export const IAuthKeyValueStorage = createIdentifier<IAuthKeyValueStorage>(
  'auth.key-value-storage'
);
