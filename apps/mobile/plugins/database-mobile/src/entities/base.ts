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

import { customType, text } from 'drizzle-orm/sqlite-core';
import { customAlphabet } from 'nanoid';

// BLOB column that surfaces raw Uint8Array on both read and write paths.
// Drizzle's stock `blob(..., { mode: 'buffer' })` reaches for `Buffer.isBuffer`
// unguarded (sqlite-core/columns/blob.js → SQLiteBlobBuffer.mapFromDriverValue),
// which throws "Property 'Buffer' doesn't exist" on Hermes — there is no Buffer
// global in React Native. expo-sqlite already binds and returns Uint8Array for
// BLOB columns, so a pass-through customType keeps the conversion off the JS
// engine entirely.
export const bytesBlob = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return 'blob';
  },
});

export const createdAt = () => text('created_at').notNull().$defaultFn(() => new Date().toISOString());

export const updatedAt = () => text('updated_at').notNull()
  .$defaultFn(() => new Date().toISOString())
  .$onUpdate(() => new Date().toISOString());

export const timestamps = {
  createdAt: createdAt(),
  updatedAt: updatedAt(),
};

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function generateId(n: number = 20): string {
  return customAlphabet(alphabet, n)();
}
