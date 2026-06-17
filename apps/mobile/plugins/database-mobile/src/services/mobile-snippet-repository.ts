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

import type { ISnippetChangeEvent } from '@termlnk/snippet';
import type { ISnippetSyncRepository, ISyncEntityRow, ISyncRowChangeEvent } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import type { ISnippetEntity } from '../entities/snippet';
import { createIdentifier, Disposable, Inject } from '@termlnk/core';
import { and, asc, eq, inArray, like, not } from 'drizzle-orm';
import { BehaviorSubject, map, Subject } from 'rxjs';
import { generateId } from '../entities/base';
import { DEFAULT_SNIPPET_ROOT, snippetEntity } from '../entities/snippet';
import { IDatabaseMobileAdaptorService } from './expo-sqlite-adaptor.service';

export interface IMobileSnippetRepository {
  readonly snippets$: Observable<readonly ISnippetEntity[]>;
  readonly packages$: Observable<readonly ISnippetEntity[]>;
  readonly changed$: Observable<ISnippetChangeEvent>;
  ready(): Promise<void>;

  getSnippetById(id: string): Promise<ISnippetEntity | null>;
  saveSnippet(entity: Omit<ISnippetEntity, 'id' | 'type' | 'tree' | 'expanded' | 'createdAt' | 'updatedAt'> & { id?: string }, opts?: { isNew?: boolean }): Promise<ISnippetEntity>;
  removeSnippet(id: string): Promise<void>;

  getPackageById(id: string): Promise<ISnippetEntity | null>;
  savePackage(entity: Omit<ISnippetEntity, 'id' | 'type' | 'tree' | 'pid' | 'content' | 'description' | 'targetHostIds' | 'favorite' | 'createdAt' | 'updatedAt'> & { id?: string; pid?: string }, opts?: { isNew?: boolean }): Promise<ISnippetEntity>;
  removePackage(id: string): Promise<void>;

  getExpandedPackageIds(): Promise<string[]>;
  setExpandedPackageIds(ids: string[]): Promise<void>;
}

export const IMobileSnippetRepository = createIdentifier<IMobileSnippetRepository>(
  'mobile.snippet-repository.service'
);

export class MobileSnippetRepository extends Disposable implements IMobileSnippetRepository {
  private readonly _snippets$ = new BehaviorSubject<readonly ISnippetEntity[]>([]);
  readonly snippets$: Observable<readonly ISnippetEntity[]> = this._snippets$.asObservable();

  private readonly _packages$ = new BehaviorSubject<readonly ISnippetEntity[]>([]);
  readonly packages$: Observable<readonly ISnippetEntity[]> = this._packages$.asObservable();

  private readonly _changed$ = new Subject<ISnippetChangeEvent>();
  readonly changed$: Observable<ISnippetChangeEvent> = this._changed$.asObservable();

  private _readyPromise: Promise<void> | null = null;

  constructor(
    @Inject(IDatabaseMobileAdaptorService) private readonly _adaptor: IDatabaseMobileAdaptorService
  ) {
    super();
  }

  override dispose(): void {
    super.dispose();
    this._snippets$.complete();
    this._packages$.complete();
    this._changed$.complete();
  }

  ready(): Promise<void> {
    if (!this._readyPromise) {
      this._readyPromise = this._refreshAll();
    }
    return this._readyPromise;
  }

  async getSnippetById(id: string): Promise<ISnippetEntity | null> {
    const db = await this._adaptor.ready();
    const row = db.select().from(snippetEntity).where(eq(snippetEntity.id, id)).get();
    return row ?? null;
  }

  async saveSnippet(
    entity: Omit<ISnippetEntity, 'id' | 'type' | 'tree' | 'expanded' | 'createdAt' | 'updatedAt'> & { id?: string },
    opts?: { isNew?: boolean }
  ): Promise<ISnippetEntity> {
    const id = entity.id || generateId();
    const now = new Date().toISOString();
    const pid = entity.pid || DEFAULT_SNIPPET_ROOT;
    const tree = await this._buildTreePath(id, pid);
    const row: ISnippetEntity = { ...entity, id, pid, tree, type: 'snippet', expanded: false, createdAt: now, updatedAt: now };
    await this._upsertRowInternal(row);
    this._changed$.next({ type: 'snippet', action: opts?.isNew ? 'add' : 'update', id, pid });
    const saved = await this.getSnippetById(id);
    return saved!;
  }

  async removeSnippet(id: string): Promise<void> {
    const entity = await this.getSnippetById(id);
    const pid = entity?.pid || DEFAULT_SNIPPET_ROOT;
    await this._deleteSingleInternal(id);
    this._changed$.next({ type: 'snippet', action: 'delete', id, pid });
  }

  async getPackageById(id: string): Promise<ISnippetEntity | null> {
    const db = await this._adaptor.ready();
    const row = db
      .select()
      .from(snippetEntity)
      .where(and(eq(snippetEntity.id, id), eq(snippetEntity.type, 'package')))
      .get();
    return row ?? null;
  }

  async savePackage(
    entity: Omit<ISnippetEntity, 'id' | 'type' | 'tree' | 'pid' | 'content' | 'description' | 'targetHostIds' | 'favorite' | 'createdAt' | 'updatedAt'> & { id?: string; pid?: string },
    opts?: { isNew?: boolean }
  ): Promise<ISnippetEntity> {
    const id = entity.id || generateId();
    const now = new Date().toISOString();
    const pid = entity.pid || DEFAULT_SNIPPET_ROOT;
    const tree = await this._buildTreePath(id, pid);
    const row: ISnippetEntity = { ...entity, id, pid, tree, type: 'package', content: null, description: null, targetHostIds: null, favorite: false, createdAt: now, updatedAt: now };
    await this._upsertRowInternal(row);
    this._changed$.next({ type: 'package', action: opts?.isNew ? 'add' : 'update', id, pid });
    const saved = await this.getPackageById(id);
    return saved!;
  }

  async removePackage(id: string): Promise<void> {
    const entity = await this.getSnippetById(id);
    if (!entity) {
      return;
    }
    const descendantIds = await this._deleteCascadeInternal(id, entity);
    for (const descId of descendantIds) {
      this._changed$.next({ type: 'snippet', action: 'delete', id: descId, pid: id });
    }
    this._changed$.next({ type: 'package', action: 'delete', id, pid: entity.pid });
  }

  async getExpandedPackageIds(): Promise<string[]> {
    const db = await this._adaptor.ready();
    const rows = db
      .select({ id: snippetEntity.id })
      .from(snippetEntity)
      .where(and(eq(snippetEntity.type, 'package'), eq(snippetEntity.expanded, true)))
      .all();
    return rows.map((r) => r.id);
  }

  async setExpandedPackageIds(ids: string[]): Promise<void> {
    // Per-device toggle. Match desktop SnippetRepository.setExpandedPackageIds — no
    // changed$ emit (avoid pushing a mutation just for opening a folder); the column
    // lazy-syncs through the next other-field push on the same row.
    const db = await this._adaptor.ready();
    if (ids.length === 0) {
      db.update(snippetEntity)
        .set({ expanded: false })
        .where(and(eq(snippetEntity.type, 'package'), eq(snippetEntity.expanded, true)))
        .run();
      await this._refreshAll();
      return;
    }
    db.update(snippetEntity)
      .set({ expanded: true })
      .where(and(eq(snippetEntity.type, 'package'), inArray(snippetEntity.id, ids), eq(snippetEntity.expanded, false)))
      .run();
    db.update(snippetEntity)
      .set({ expanded: false })
      .where(and(eq(snippetEntity.type, 'package'), not(inArray(snippetEntity.id, ids)), eq(snippetEntity.expanded, true)))
      .run();
    await this._refreshAll();
  }

  // --- Sync engine adapter: single table, all rows ---

  static toSyncRepository(repo: MobileSnippetRepository): ISnippetSyncRepository {
    return {
      changed$: repo._changed$.pipe(
        map((e): ISyncRowChangeEvent => ({ type: e.action === 'move' ? 'update' : e.action, id: e.id }))
      ),
      getList: async () => {
        const db = await repo._adaptor.ready();
        return db.select().from(snippetEntity).orderBy(asc(snippetEntity.sort), asc(snippetEntity.id)).all() as unknown as ISyncEntityRow[];
      },
      getById: async (id) => (await repo.getSnippetById(id)) as unknown as ISyncEntityRow | undefined,
      syncUpsertRow: async (entity) => {
        const row = entity as unknown as ISnippetEntity;
        await repo._upsertRowInternal(row);
        const eventType: ISnippetChangeEvent['type'] = (row.type === 'package') ? 'package' : 'snippet';
        repo._changed$.next({ type: eventType, action: 'update', id: row.id, pid: row.pid ?? DEFAULT_SNIPPET_ROOT });
      },
      delete: async (id) => {
        const existing = await repo.getSnippetById(id);
        if (existing) {
          if (existing.type === 'package') {
            await repo._deleteCascadeInternal(id, existing);
          } else {
            await repo._deleteSingleInternal(id);
          }
        }
        const eventType: ISnippetChangeEvent['type'] = existing?.type === 'package' ? 'package' : 'snippet';
        repo._changed$.next({ type: eventType, action: 'delete', id, pid: existing?.pid ?? DEFAULT_SNIPPET_ROOT });
      },
    };
  }

  // --- Internal write helpers ---

  private async _upsertRowInternal(entity: ISnippetEntity): Promise<void> {
    const db = await this._adaptor.ready();
    const now = new Date().toISOString();
    db.insert(snippetEntity)
      .values({
        id: entity.id,
        label: entity.label,
        type: entity.type,
        pid: entity.pid ?? DEFAULT_SNIPPET_ROOT,
        tree: entity.tree ?? '',
        content: entity.content ?? null,
        description: entity.description ?? null,
        targetHostIds: entity.targetHostIds ?? null,
        favorite: entity.favorite ?? false,
        expanded: entity.expanded ?? false,
        sort: entity.sort ?? 0,
        createdAt: entity.createdAt ?? now,
        updatedAt: entity.updatedAt ?? now,
      })
      .onConflictDoUpdate({
        target: snippetEntity.id,
        set: {
          label: entity.label,
          type: entity.type,
          pid: entity.pid ?? DEFAULT_SNIPPET_ROOT,
          tree: entity.tree ?? '',
          content: entity.content ?? null,
          description: entity.description ?? null,
          targetHostIds: entity.targetHostIds ?? null,
          favorite: entity.favorite ?? false,
          expanded: entity.expanded ?? false,
          sort: entity.sort ?? 0,
          updatedAt: entity.updatedAt ?? now,
        },
      })
      .run();
    await this._refreshAll();
  }

  private async _deleteSingleInternal(id: string): Promise<void> {
    const db = await this._adaptor.ready();
    db.delete(snippetEntity).where(eq(snippetEntity.id, id)).run();
    await this._refreshAll();
  }

  /**
   * Cascade-delete a package and all descendants whose tree path starts with
   * the package's own tree prefix (mirrors desktop SnippetRepository._deletePackageCascade).
   * Returns the IDs of deleted descendants (excluding the package itself).
   */
  private async _deleteCascadeInternal(id: string, entity: ISnippetEntity): Promise<string[]> {
    const db = await this._adaptor.ready();
    const descendants = db
      .select({ id: snippetEntity.id })
      .from(snippetEntity)
      .where(
        and(
          not(eq(snippetEntity.id, id)),
          like(snippetEntity.tree, `${entity.tree}%`)
        )
      )
      .all();

    const allIds = [id, ...descendants.map((d) => d.id)];
    db.transaction((tx) => {
      tx.delete(snippetEntity).where(inArray(snippetEntity.id, allIds)).run();
    });
    await this._refreshAll();
    return descendants.map((d) => d.id);
  }

  // --- Tree path helpers ---

  private async _buildTreePath(id: string, pid: string): Promise<string> {
    if (pid === DEFAULT_SNIPPET_ROOT) {
      return `${DEFAULT_SNIPPET_ROOT}_${id}`;
    }
    const parentTree = await this._getTreeById(pid);
    return `${parentTree}_${id}`;
  }

  private async _getTreeById(id: string): Promise<string> {
    if (id === DEFAULT_SNIPPET_ROOT || id === '') {
      return DEFAULT_SNIPPET_ROOT;
    }
    const db = await this._adaptor.ready();
    const row = db
      .select({ tree: snippetEntity.tree })
      .from(snippetEntity)
      .where(eq(snippetEntity.id, id))
      .get();
    if (!row) {
      throw new Error(`Snippet/package with id ${id} not found`);
    }
    return row.tree;
  }

  private async _refreshAll(): Promise<void> {
    const db = await this._adaptor.ready();
    const snippets = db
      .select()
      .from(snippetEntity)
      .where(eq(snippetEntity.type, 'snippet'))
      .orderBy(asc(snippetEntity.sort), asc(snippetEntity.id))
      .all();
    this._snippets$.next(snippets);
    const packages = db
      .select()
      .from(snippetEntity)
      .where(eq(snippetEntity.type, 'package'))
      .orderBy(asc(snippetEntity.sort), asc(snippetEntity.id))
      .all();
    this._packages$.next(packages);
  }
}
