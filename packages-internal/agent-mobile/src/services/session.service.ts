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
import type { IDatabaseMobileAdaptorService } from '@termlnk/database-mobile';
import type { Observable } from 'rxjs';
import type { IMobileChatSession } from '../models/session';
import { createIdentifier, Disposable, ILogService as ILogServiceId, Inject } from '@termlnk/core';
import { aiChatMessageEntity, aiChatSessionEntity, IDatabaseMobileAdaptorService as IDatabaseMobileAdaptorServiceId } from '@termlnk/database-mobile';
import { desc, eq } from 'drizzle-orm';
import { BehaviorSubject } from 'rxjs';

export interface IMobileSessionService {
  readonly sessions$: Observable<readonly IMobileChatSession[]>;

  listSessions(): Promise<readonly IMobileChatSession[]>;
  deleteSession(sessionId: string): Promise<void>;
  renameSession(sessionId: string, title: string): Promise<void>;
  refresh(): Promise<void>;
}

export const IMobileSessionService = createIdentifier<IMobileSessionService>('mobile.session.service');

export class MobileSessionService extends Disposable implements IMobileSessionService {
  private readonly _sessions$ = new BehaviorSubject<readonly IMobileChatSession[]>([]);
  readonly sessions$: Observable<readonly IMobileChatSession[]> = this._sessions$.asObservable();

  private readonly _dbAdaptor: IDatabaseMobileAdaptorService;
  private readonly _logService: ILogService;

  constructor(
    @Inject(IDatabaseMobileAdaptorServiceId) dbAdaptor: IDatabaseMobileAdaptorService,
    @Inject(ILogServiceId) logService: ILogService
  ) {
    super();
    this._dbAdaptor = dbAdaptor;
    this._logService = logService;
  }

  override dispose(): void {
    super.dispose();
    this._sessions$.complete();
  }

  async listSessions(): Promise<readonly IMobileChatSession[]> {
    try {
      const db = await this._dbAdaptor.ready();
      const rows = db.select()
        .from(aiChatSessionEntity)
        .orderBy(desc(aiChatSessionEntity.updatedAt))
        .all();

      const sessions: IMobileChatSession[] = rows.map((row) => ({
        id: row.id,
        title: row.title,
        providerId: row.providerId ?? undefined,
        modelId: row.modelId ?? undefined,
        messageCount: row.messageCount,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));

      this._sessions$.next(sessions);
      return sessions;
    } catch (err) {
      this._logService.warn('[MobileSessionService] listSessions failed:', err);
      return [];
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const db = await this._dbAdaptor.ready();
      db.delete(aiChatMessageEntity).where(eq(aiChatMessageEntity.sessionId, sessionId)).run();
      db.delete(aiChatSessionEntity).where(eq(aiChatSessionEntity.id, sessionId)).run();
      await this.listSessions();
    } catch (err) {
      this._logService.warn('[MobileSessionService] deleteSession failed:', err);
    }
  }

  async renameSession(sessionId: string, title: string): Promise<void> {
    try {
      const db = await this._dbAdaptor.ready();
      db.update(aiChatSessionEntity)
        .set({ title, updatedAt: new Date().toISOString() })
        .where(eq(aiChatSessionEntity.id, sessionId))
        .run();
      await this.listSessions();
    } catch (err) {
      this._logService.warn('[MobileSessionService] renameSession failed:', err);
    }
  }

  async refresh(): Promise<void> {
    await this.listSessions();
  }
}
