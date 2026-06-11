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
import { and, desc, eq, sql } from 'drizzle-orm';
import { BehaviorSubject } from 'rxjs';
import { recentSessionEntity } from '../entities/recent-session';
import { IDatabaseMobileAdaptorService } from './expo-sqlite-adaptor.service';

export type IRecentSessionKind = 'terminal' | 'sftp';

export interface IRecentSession {
  readonly hostId: string;
  readonly kind: IRecentSessionKind;
  readonly lastUsedAt: number;
}

// Cap matches Termius/JuiceSSH recent lists which never go above ~50 — anything
// deeper is a "use the host list" workflow, not a "use Recent" workflow.
const MAX_RECENTS = 50;

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

export class RecentSessionsRepository extends Disposable implements IRecentSessionsRepository {
  private readonly _sessions$ = new BehaviorSubject<readonly IRecentSession[]>([]);
  readonly sessions$: Observable<readonly IRecentSession[]> = this._sessions$.asObservable();

  private _readyPromise: Promise<void> | null = null;

  private readonly _adaptor: IDatabaseMobileAdaptorService;
  private readonly _logService: ILogService;

  constructor(
    @Inject(IDatabaseMobileAdaptorService) adaptor: IDatabaseMobileAdaptorService,
    @Inject(ILogService) logService: ILogService
  ) {
    super();
    this._adaptor = adaptor;
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
    const db = await this._adaptor.ready();
    const now = Date.now();
    db.insert(recentSessionEntity)
      .values({ hostId, kind, lastUsedAt: now })
      .onConflictDoUpdate({
        target: [recentSessionEntity.hostId, recentSessionEntity.kind],
        set: { lastUsedAt: now },
      })
      .run();
    // Prune past the cap. Done inline because we keep the table tiny; the cost
    // of a single DELETE-WHERE is negligible compared to the SELECT we already
    // do on refresh.
    db.run(sql`DELETE FROM ${recentSessionEntity} WHERE rowid NOT IN (
      SELECT rowid FROM ${recentSessionEntity} ORDER BY ${recentSessionEntity.lastUsedAt} DESC LIMIT ${MAX_RECENTS}
    )`);
    await this._refresh();
  }

  async remove(hostId: string, kind: IRecentSessionKind): Promise<void> {
    const db = await this._adaptor.ready();
    db.delete(recentSessionEntity)
      .where(and(eq(recentSessionEntity.hostId, hostId), eq(recentSessionEntity.kind, kind)))
      .run();
    await this._refresh();
  }

  async clear(): Promise<void> {
    const db = await this._adaptor.ready();
    db.delete(recentSessionEntity).run();
    await this._refresh();
  }

  private async _refresh(): Promise<void> {
    try {
      const db = await this._adaptor.ready();
      const rows = db.select()
        .from(recentSessionEntity)
        .orderBy(desc(recentSessionEntity.lastUsedAt))
        .limit(MAX_RECENTS)
        .all();
      const sessions: IRecentSession[] = rows.map((row) => ({
        hostId: row.hostId,
        kind: row.kind === 'sftp' ? 'sftp' : 'terminal',
        lastUsedAt: row.lastUsedAt,
      }));
      this._sessions$.next(sessions);
    } catch (err) {
      this._logService.warn('[RecentSessionsRepository] refresh failed:', err);
    }
  }
}
