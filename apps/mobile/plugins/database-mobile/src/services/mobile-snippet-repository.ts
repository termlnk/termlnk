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

import type { ISnippetSyncRepository, ISyncEntityRow, ISyncRowChangeEvent } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import type { ISnippetEntity } from '../entities/snippet';
import type { IMobileSnippet, IMobileSnippetRunMode } from '../types';
import { createIdentifier, Disposable, generateRandomId, Inject } from '@termlnk/core';
import { asc, eq } from 'drizzle-orm';
import { BehaviorSubject, Subject } from 'rxjs';
import { snippetEntity } from '../entities/snippet';
import { IDatabaseMobileAdaptorService } from './database-mobile-adaptor.service';

function nowIso(): string {
  return new Date().toISOString();
}

interface ISnippetWire {
  readonly id: string;
  readonly name?: string | null;
  readonly command?: string | null;
  readonly description?: string | null;
  readonly groupId?: string | null;
  readonly runMode?: IMobileSnippetRunMode | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export interface IMobileSnippetRepository extends ISnippetSyncRepository {
  readonly snippets$: Observable<readonly IMobileSnippet[]>;
  ready(): Promise<void>;
  createSnippet(input: {
    readonly name: string;
    readonly command: string;
    readonly description?: string | null;
    readonly groupId?: string | null;
    readonly runMode?: IMobileSnippetRunMode;
  }): Promise<string>;
  updateSnippet(input: {
    readonly id: string;
    readonly name: string;
    readonly command: string;
    readonly description?: string | null;
    readonly groupId?: string | null;
    readonly runMode?: IMobileSnippetRunMode;
  }): Promise<void>;
  deleteSnippet(id: string): Promise<void>;
}

export const IMobileSnippetRepository = createIdentifier<IMobileSnippetRepository>('mobile.snippet-repository');

export class MobileSnippetRepository extends Disposable implements IMobileSnippetRepository {
  private readonly _snippets$ = new BehaviorSubject<readonly IMobileSnippet[]>([]);
  readonly snippets$: Observable<readonly IMobileSnippet[]> = this._snippets$.asObservable();

  private readonly _changed$ = new Subject<ISyncRowChangeEvent>();
  readonly changed$: Observable<ISyncRowChangeEvent> = this._changed$.asObservable();

  private _readyPromise: Promise<void> | null = null;

  private readonly _adaptor: IDatabaseMobileAdaptorService;

  constructor(
    @Inject(IDatabaseMobileAdaptorService) adaptor: IDatabaseMobileAdaptorService
  ) {
    super();
    this._adaptor = adaptor;
  }

  override dispose(): void {
    super.dispose();
    this._snippets$.complete();
    this._changed$.complete();
  }

  ready(): Promise<void> {
    if (!this._readyPromise) {
      this._readyPromise = this._refresh();
    }
    return this._readyPromise;
  }

  async getList(): Promise<ISyncEntityRow[]> {
    const db = await this._adaptor.ready();
    const rows = db.select().from(snippetEntity).all();
    return rows.map((row) => this._toSyncRow(row));
  }

  async getById(id: string): Promise<ISyncEntityRow | null> {
    const db = await this._adaptor.ready();
    const row = db.select().from(snippetEntity).where(eq(snippetEntity.id, id)).get();
    return row ? this._toSyncRow(row) : null;
  }

  async syncUpsertRow(entity: ISyncEntityRow): Promise<void> {
    const existing = await this.getById(entity.id);
    await this._persist(this._normaliseWire(entity as unknown as ISnippetWire));
    await this._refresh();
    this._changed$.next({ type: existing ? 'update' : 'add', id: entity.id });
  }

  async delete(id: string): Promise<void> {
    const db = await this._adaptor.ready();
    db.delete(snippetEntity).where(eq(snippetEntity.id, id)).run();
    await this._refresh();
    this._changed$.next({ type: 'delete', id });
  }

  async createSnippet(input: {
    readonly name: string;
    readonly command: string;
    readonly description?: string | null;
    readonly groupId?: string | null;
    readonly runMode?: IMobileSnippetRunMode;
  }): Promise<string> {
    const id = generateRandomId(24);
    const now = nowIso();
    await this._persist({
      id,
      name: input.name,
      command: input.command,
      description: input.description ?? null,
      groupId: input.groupId ?? null,
      runMode: input.runMode ?? 'insert',
      createdAt: now,
      updatedAt: now,
    });
    await this._refresh();
    this._changed$.next({ type: 'add', id });
    return id;
  }

  async updateSnippet(input: {
    readonly id: string;
    readonly name: string;
    readonly command: string;
    readonly description?: string | null;
    readonly groupId?: string | null;
    readonly runMode?: IMobileSnippetRunMode;
  }): Promise<void> {
    const db = await this._adaptor.ready();
    const existing = db.select().from(snippetEntity).where(eq(snippetEntity.id, input.id)).get();
    await this._persist({
      id: input.id,
      name: input.name,
      command: input.command,
      description: input.description ?? null,
      groupId: input.groupId ?? null,
      runMode: input.runMode ?? existing?.runMode ?? 'insert',
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    });
    await this._refresh();
    this._changed$.next({ type: 'update', id: input.id });
  }

  async deleteSnippet(id: string): Promise<void> {
    await this.delete(id);
  }

  private _toSyncRow(row: ISnippetEntity): ISyncEntityRow {
    return {
      id: row.id,
      name: row.name,
      command: row.command,
      description: row.description,
      groupId: row.groupId,
      runMode: row.runMode,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } as unknown as ISyncEntityRow;
  }

  private _normaliseWire(row: ISnippetWire): IMobileSnippet {
    const now = nowIso();
    return {
      id: row.id,
      name: row.name ?? '',
      command: row.command ?? '',
      description: row.description ?? null,
      groupId: row.groupId ?? null,
      runMode: row.runMode ?? 'insert',
      createdAt: row.createdAt ?? now,
      updatedAt: row.updatedAt ?? now,
    };
  }

  private async _persist(row: IMobileSnippet): Promise<void> {
    const db = await this._adaptor.ready();
    db.insert(snippetEntity)
      .values({
        id: row.id,
        name: row.name,
        command: row.command,
        description: row.description ?? null,
        groupId: row.groupId ?? null,
        runMode: row.runMode,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })
      .onConflictDoUpdate({
        target: snippetEntity.id,
        set: {
          name: row.name,
          command: row.command,
          description: row.description ?? null,
          groupId: row.groupId ?? null,
          runMode: row.runMode,
          updatedAt: row.updatedAt,
        },
      })
      .run();
  }

  private async _refresh(): Promise<void> {
    const db = await this._adaptor.ready();
    const rows = db.select().from(snippetEntity).orderBy(asc(snippetEntity.name)).all();
    this._snippets$.next(rows.map((row) => ({
      id: row.id,
      name: row.name,
      command: row.command,
      description: row.description,
      groupId: row.groupId,
      runMode: row.runMode,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })));
  }
}
