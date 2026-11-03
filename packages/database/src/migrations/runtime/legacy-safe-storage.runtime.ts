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

import type { ILogService } from '@termlnk/core';
import type BetterSqlite3 from 'better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { DEFAULT_DRIZZLE_MIGRATIONS_TABLE } from '../../config/migrations';
import { SECRET_CIPHER_PREFIX } from '../../services/secret-cipher.service';
import { LEGACY_SAFE_STORAGE_SCHEME, tryDecodeSecretPayload } from '../../services/secret-cipher/secret-payload';

// TEMPORARY: one-time migration of per-field `safe-storage` payloads (sync Electron
// safeStorage, removed in Electron 46) to the envelope scheme. Remove together with
// LEGACY_SAFE_STORAGE_SCHEME once users have migrated.
//
// Platform-agnostic: it only scans every TEXT cell for `tmenc1:` tokens (plain columns and
// JSON columns alike) and delegates the actual re-encryption to the injected `rewrap`.
// Returning null from `rewrap` leaves the token untouched; it is retried on the next launch,
// which is idempotent because migrated tokens no longer carry the legacy scheme.
export type LegacyTokenRewrap = (legacyToken: string) => Promise<string | null>;

export interface ILegacySafeStorageMigrationResult {
  tablesScanned: number;
  rowsUpdated: number;
  tokensRewrapped: number;
  tokensFailed: number;
}

interface ITableInfoRow {
  name: string;
  type: string;
}

type RowRecord = Record<string, unknown> & { __rowid: number };

const TOKEN_PATTERN = new RegExp(`${SECRET_CIPHER_PREFIX}[A-Za-z0-9+/=]+`, 'g');
const TEXT_AFFINITY_PATTERN = /TEXT|CHAR|CLOB/i;

export async function migrateLegacySafeStorageSecrets(
  db: BetterSQLite3Database,
  rewrap: LegacyTokenRewrap,
  logService: ILogService
): Promise<ILegacySafeStorageMigrationResult> {
  const result: ILegacySafeStorageMigrationResult = {
    tablesScanned: 0,
    rowsUpdated: 0,
    tokensRewrapped: 0,
    tokensFailed: 0,
  };
  // drizzle's static type omits $client on the adaptor-facing Database alias, but it is always
  // present on better-sqlite3 instances.
  const sqlite = (db as BetterSQLite3Database & { $client: BetterSqlite3.Database }).$client;

  const tables = sqlite
    .prepare('SELECT name FROM sqlite_master WHERE type = \'table\'')
    .all()
    .map((row) => (row as { name: string }).name)
    .filter((name) => !name.startsWith('sqlite_') && name !== DEFAULT_DRIZZLE_MIGRATIONS_TABLE);

  for (const table of tables) {
    try {
      const columns = (sqlite.prepare(`PRAGMA table_info(${_quote(table)})`).all() as ITableInfoRow[])
        .filter((column) => TEXT_AFFINITY_PATTERN.test(column.type))
        .map((column) => column.name);
      if (columns.length === 0) {
        continue;
      }
      result.tablesScanned += 1;

      const where = columns
        .map((column) => `(typeof(${_quote(column)}) = 'text' AND ${_quote(column)} LIKE '%${SECRET_CIPHER_PREFIX}%')`)
        .join(' OR ');
      const rows = sqlite
        .prepare(`SELECT rowid AS __rowid, ${columns.map(_quote).join(', ')} FROM ${_quote(table)} WHERE ${where}`)
        .all() as RowRecord[];

      for (const row of rows) {
        const updates: Record<string, string> = {};

        for (const column of columns) {
          const value = row[column];
          if (typeof value !== 'string') {
            continue;
          }
          const rewritten = await _rewrapCell(value, rewrap, logService, result);
          if (rewritten !== value) {
            updates[column] = rewritten;
          }
        }

        const changed = Object.keys(updates);
        if (changed.length === 0) {
          continue;
        }

        // Raw SQL on purpose: the plaintext is unchanged, so updatedAt / sync row meta must
        // not move or every device would see a spurious edit and re-sync the row.
        const assignments = changed.map((column) => `${_quote(column)} = ?`).join(', ');
        const params = [...changed.map((column) => updates[column]), row.__rowid];
        sqlite.prepare(`UPDATE ${_quote(table)} SET ${assignments} WHERE rowid = ?`).run(...params);
        result.rowsUpdated += 1;
      }
    } catch (error) {
      logService.warn(`[LegacySafeStorageMigration] Failed to scan table '${table}':`, error);
    }
  }

  return result;
}

async function _rewrapCell(
  cell: string,
  rewrap: LegacyTokenRewrap,
  logService: ILogService,
  result: ILegacySafeStorageMigrationResult
): Promise<string> {
  const tokens = new Set<string>();
  for (const match of cell.matchAll(TOKEN_PATTERN)) {
    if (tryDecodeSecretPayload(match[0])?.scheme === LEGACY_SAFE_STORAGE_SCHEME) {
      tokens.add(match[0]);
    }
  }
  if (tokens.size === 0) {
    return cell;
  }

  const replacements = new Map<string, string>();
  for (const token of tokens) {
    let replacement: string | null = null;
    try {
      replacement = await rewrap(token);
    } catch (error) {
      logService.warn('[LegacySafeStorageMigration] Failed to re-wrap a value; leaving it untouched:', error);
    }
    if (replacement === null) {
      result.tokensFailed += 1;
    } else {
      result.tokensRewrapped += 1;
      replacements.set(token, replacement);
    }
  }

  return cell.replace(TOKEN_PATTERN, (token) => replacements.get(token) ?? token);
}

function _quote(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
