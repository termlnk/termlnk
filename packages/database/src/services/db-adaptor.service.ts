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

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as entities from '../entities';
import { createIdentifier } from '@termlnk/core';

export type Database = BetterSQLite3Database<typeof entities>;

export interface IDBAdaptorService {
  readonly db: Database;
  initialize(): Promise<void>;
  close(): Promise<void>;
}
export const IDBAdaptorService = createIdentifier<IDBAdaptorService>('database.db-adaptor-service');
