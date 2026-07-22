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

import type { IChatMessageEntityInsert, IChatSessionEntityInsert } from '../entities/chat';
import { Disposable } from '@termlnk/core';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { Subject } from 'rxjs';
import { chatMessageEntity, chatSessionEntity } from '../entities/chat';
import { IDBAdaptorService } from '../services/db-adaptor.service';

export interface IChatSessionChangeEvent {
  type: 'add' | 'update' | 'delete';
  sessionId: string;
}

export class ChatRepository extends Disposable {
  private readonly _changed$ = new Subject<IChatSessionChangeEvent>();
  readonly changed$ = this._changed$.asObservable();

  constructor(
    @IDBAdaptorService private readonly _dbService: IDBAdaptorService
  ) {
    super();
  }

  private get _db() {
    return this._dbService.db;
  }

  // ---------------------------------------------------------------------------
  // Session CRUD
  // ---------------------------------------------------------------------------

  async createSession(data: IChatSessionEntityInsert) {
    await this._db.insert(chatSessionEntity).values(data);
    this._changed$.next({ type: 'add', sessionId: data.id });
    return data.id;
  }

  async getSession(id: string) {
    const rows = await this._db
      .select()
      .from(chatSessionEntity)
      .where(eq(chatSessionEntity.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async listSessions() {
    return this._db
      .select()
      .from(chatSessionEntity)
      .orderBy(desc(chatSessionEntity.accessedAt));
  }

  async updateSession(id: string, data: Partial<Omit<IChatSessionEntityInsert, 'id'>>) {
    await this._db
      .update(chatSessionEntity)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(chatSessionEntity.id, id));
    this._changed$.next({ type: 'update', sessionId: id });
  }

  async deleteSession(id: string) {
    // Messages are cascade-deleted via foreign key (PRAGMA foreign_keys = ON)
    await this._db.delete(chatSessionEntity).where(eq(chatSessionEntity.id, id));
    this._changed$.next({ type: 'delete', sessionId: id });
  }

  async renameSession(id: string, title: string) {
    await this._db
      .update(chatSessionEntity)
      .set({ title, updatedAt: new Date().toISOString() })
      .where(eq(chatSessionEntity.id, id));
    this._changed$.next({ type: 'update', sessionId: id });
  }

  // ---------------------------------------------------------------------------
  // Message CRUD
  // ---------------------------------------------------------------------------

  async addMessage(data: IChatMessageEntityInsert) {
    await this._db.insert(chatMessageEntity).values(data);
    // Update session message count and accessed time
    await this._db
      .update(chatSessionEntity)
      .set({
        messageCount: sql`${chatSessionEntity.messageCount} + 1`,
        accessedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(chatSessionEntity.id, data.sessionId));
  }

  async getMessages(sessionId: string) {
    return this._db
      .select()
      .from(chatMessageEntity)
      .where(eq(chatMessageEntity.sessionId, sessionId))
      .orderBy(asc(chatMessageEntity.sortOrder));
  }

  async deleteMessagesBySessionId(sessionId: string) {
    await this._db.delete(chatMessageEntity).where(eq(chatMessageEntity.sessionId, sessionId));
    await this._db
      .update(chatSessionEntity)
      .set({
        messageCount: 0,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(chatSessionEntity.id, sessionId));
  }

  async replaceSessionMessages(sessionId: string, messages: IChatMessageEntityInsert[]) {
    await this._db.delete(chatMessageEntity).where(eq(chatMessageEntity.sessionId, sessionId));
    if (messages.length > 0) {
      await this._db.insert(chatMessageEntity).values(messages);
    }
    await this._db
      .update(chatSessionEntity)
      .set({
        messageCount: messages.length,
        accessedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(chatSessionEntity.id, sessionId));
  }

  async updateMessage(id: string, data: Partial<Omit<IChatMessageEntityInsert, 'id' | 'sessionId' | 'sortOrder'>>) {
    await this._db
      .update(chatMessageEntity)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(chatMessageEntity.id, id));
  }

  async getMessageCount(sessionId: string): Promise<number> {
    const rows = await this._db
      .select({ count: sql<number>`count(*)` })
      .from(chatMessageEntity)
      .where(eq(chatMessageEntity.sessionId, sessionId));
    return rows[0]?.count ?? 0;
  }
}
