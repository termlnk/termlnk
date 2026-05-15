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
import { createIdentifier, Disposable, ILogService, Inject } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';
import { IMobileSqliteDatabaseService } from '../storage/mobile-sqlite-database.service';

export type IRecentSessionKind = 'terminal' | 'sftp';

export interface IRecentSession {
  readonly hostId: string;
  readonly kind: IRecentSessionKind;
  readonly lastUsedAt: number;
}

// Cap matches Termius/JuiceSSH recent lists which never go above ~50 — anything
// deeper is a "use the host list" workflow, not a "use Recent" workflow.
const MAX_RECENTS = 50;

interface IRecentSessionRow {
  host_id: string;
  kind: string;
  last_used_at: number;
}

export interface IRecentSessionsRepository {
  readonly sessions$: Observable<readonly IRecentSession[]>;
  ready(): Promise<void>;
  touch(hostId: string, kind: IRecentSessionKind): Promise<void>;
  remove(hostId: string, kind: IRecentSessionKind): Promise<void>;
  clear(): Promise<void>;
}

export const IRecentSessionsRepository = createIdentifier<IRecentSessionsRepository>(
  'mobile.recent-sessions.repository'
);

export class RecentSessionsRepository
  extends Disposable
  implements IRecentSessionsRepository {
  private readonly _sessions$ = new BehaviorSubject<readonly IRecentSession[]>([]);
  readonly sessions$: Observable<readonly IRecentSession[]> = this._sessions$.asObservable();

  private _readyPromise: Promise<void> | null = null;

  // Field declarations are separated from constructor parameters because
  // babel-plugin-parameter-decorator cannot pair a parameter decorator with a
  // TypeScript parameter property — see apps/mobile/babel.config.js.
  private readonly _sqlite: IMobileSqliteDatabaseService;
  private readonly _logService: ILogService;

  constructor(
    @Inject(IMobileSqliteDatabaseService) sqlite: IMobileSqliteDatabaseService,
    @Inject(ILogService) logService: ILogService
  ) {
    super();
    this._sqlite = sqlite;
    this._logService = logService;
  }

  override dispose(): void {
    super.dispose();
    this._sessions$.complete();
  }

  ready(): Promise<void> {
    if (!this._readyPromise) {
      this._readyPromise = this._refresh();
    }
    return this._readyPromise;
  }

  async touch(hostId: string, kind: IRecentSessionKind): Promise<void> {
    const db = await this._sqlite.ready();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO recent_sessions (host_id, kind, last_used_at) VALUES (?, ?, ?)
       ON CONFLICT(host_id, kind) DO UPDATE SET last_used_at = excluded.last_used_at`,
      [hostId, kind, now]
    );
    // Prune past the cap. Done inline because we keep the table tiny; the cost
    // of a single DELETE-WHERE is negligible compared to the SELECT we already
    // do on refresh.
    await db.runAsync(
      `DELETE FROM recent_sessions
       WHERE rowid NOT IN (
         SELECT rowid FROM recent_sessions ORDER BY last_used_at DESC LIMIT ?
       )`,
      [MAX_RECENTS]
    );
    await this._refresh();
  }

  async remove(hostId: string, kind: IRecentSessionKind): Promise<void> {
    const db = await this._sqlite.ready();
    await db.runAsync(
      'DELETE FROM recent_sessions WHERE host_id = ? AND kind = ?',
      [hostId, kind]
    );
    await this._refresh();
  }

  async clear(): Promise<void> {
    const db = await this._sqlite.ready();
    await db.execAsync('DELETE FROM recent_sessions;');
    await this._refresh();
  }

  private async _refresh(): Promise<void> {
    try {
      const db = await this._sqlite.ready();
      const rows = await db.getAllAsync<IRecentSessionRow>(
        `SELECT host_id, kind, last_used_at
         FROM recent_sessions
         ORDER BY last_used_at DESC
         LIMIT ?`,
        [MAX_RECENTS]
      );
      const sessions: IRecentSession[] = rows.map((row) => ({
        hostId: row.host_id,
        kind: row.kind === 'sftp' ? 'sftp' : 'terminal',
        lastUsedAt: row.last_used_at,
      }));
      this._sessions$.next(sessions);
    } catch (err) {
      this._logService.warn('[RecentSessionsRepository] refresh failed:', err);
    }
  }
}
