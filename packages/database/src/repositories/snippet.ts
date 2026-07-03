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

import type { ISnippetChangeEvent, SnippetTree } from '@termlnk/snippet';
import type { ISnippetSyncRepository, ISyncEntityRow, ISyncRowChangeEvent } from '@termlnk/sync';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { Observable } from 'rxjs';
import type * as schema from '../entities';
import type { ISnippetEntity, ISnippetEntityInsert } from '../entities';
import { Disposable } from '@termlnk/core';
import { SnippetType } from '@termlnk/snippet';
import { and, asc, desc, eq, gt, gte, inArray, like, lt, lte, not, sql } from 'drizzle-orm';
import { map, Subject } from 'rxjs';
import { generateId } from '../entities/base';
import { DEFAULT_SNIPPET_ROOT, snippetEntity } from '../entities/snippet';
import { IDBAdaptorService } from '../services/db-adaptor.service';

export class SnippetRepository extends Disposable {
  private readonly _changed$ = new Subject<ISnippetChangeEvent>();
  readonly changed$: Observable<ISnippetChangeEvent> = this._changed$.asObservable();

  constructor(
    @IDBAdaptorService private readonly _dbService: IDBAdaptorService
  ) {
    super();
  }

  private get _db() {
    return this._dbService.db as BetterSQLite3Database<typeof schema>;
  }

  // --- Sync-engine adapter ---

  static toSyncRepository(repo: SnippetRepository): ISnippetSyncRepository {
    return {
      changed$: repo._changed$.pipe(
        map((e): ISyncRowChangeEvent => ({ type: e.action === 'move' ? 'update' : e.action, id: e.id }))
      ),
      getList: () => repo._db.select().from(snippetEntity) as Promise<ISyncEntityRow[]>,
      getById: (id) => repo.getSnippetById(id) as Promise<ISyncEntityRow | undefined>,
      syncUpsertRow: (entity) => repo._syncUpsertRow(entity),
      delete: (id) => repo.delete(id),
    };
  }

  private async _syncUpsertRow(entity: ISyncEntityRow): Promise<void> {
    const row = entity as unknown as ISnippetEntityInsert;
    const exists = await this._db.$count(snippetEntity, eq(snippetEntity.id, row.id));
    if (exists > 0) {
      await this._db.update(snippetEntity).set(row).where(eq(snippetEntity.id, row.id));
      const eventType = row.type === SnippetType.PACKAGE ? 'package' : 'snippet';
      this._changed$.next({ type: eventType, action: 'update', id: row.id, pid: row.pid ?? DEFAULT_SNIPPET_ROOT });
    } else {
      await this._db.insert(snippetEntity).values(row);
      const eventType = row.type === SnippetType.PACKAGE ? 'package' : 'snippet';
      this._changed$.next({ type: eventType, action: 'add', id: row.id, pid: row.pid ?? DEFAULT_SNIPPET_ROOT });
    }
  }

  // --- Read operations ---

  async getAllSnippets(): Promise<ISnippetEntity[]> {
    return this._db.select().from(snippetEntity).where(eq(snippetEntity.type, SnippetType.SNIPPET));
  }

  async getSnippetById(id: string): Promise<ISnippetEntity | undefined> {
    const result = await this._db.select().from(snippetEntity).where(eq(snippetEntity.id, id)).limit(1);
    return result[0];
  }

  async getByPid(pid: string): Promise<ISnippetEntity[]> {
    return this._db.select().from(snippetEntity).where(eq(snippetEntity.pid, pid)).orderBy(asc(snippetEntity.sort));
  }

  async getItemById(id: string): Promise<ISnippetEntity | undefined> {
    const result = await this._db.select().from(snippetEntity).where(eq(snippetEntity.id, id)).limit(1);
    return result[0];
  }

  async getAllPackages(): Promise<ISnippetEntity[]> {
    return this._db.select().from(snippetEntity).where(eq(snippetEntity.type, SnippetType.PACKAGE));
  }

  async getPackageById(id: string): Promise<ISnippetEntity | undefined> {
    const result = await this._db
      .select()
      .from(snippetEntity)
      .where(and(eq(snippetEntity.id, id), eq(snippetEntity.type, SnippetType.PACKAGE)))
      .limit(1);
    return result[0];
  }

  async getTree(rootId: string = DEFAULT_SNIPPET_ROOT): Promise<SnippetTree[]> {
    if (!rootId) {
      return [];
    }
    const list = rootId === DEFAULT_SNIPPET_ROOT
      ? await this._db.select().from(snippetEntity)
      : await this._db.select().from(snippetEntity).where(like(snippetEntity.tree, `${rootId}%`));

    return this._buildTree(list, rootId);
  }

  async getDescendants(id: string): Promise<ISnippetEntity[]> {
    const treePrefix = await this._getTreeById(id);
    return this._db
      .select()
      .from(snippetEntity)
      .where(
        and(
          not(eq(snippetEntity.id, id)),
          like(snippetEntity.tree, `${treePrefix}%`)
        )
      );
  }

  // --- Write operations ---

  async createSnippet(record: Omit<ISnippetEntityInsert, 'id' | 'type' | 'tree'> & { id?: string }): Promise<string> {
    const id = record.id || generateId();
    const pid = record.pid || DEFAULT_SNIPPET_ROOT;
    const tree = await this._buildTreePath(id, pid);
    const maxSort = await this._getMaxSortByPid(pid);

    await this._db.insert(snippetEntity).values({
      ...record,
      id,
      pid,
      tree,
      type: SnippetType.SNIPPET,
      sort: record.sort ?? maxSort + 1,
    });
    this._changed$.next({ type: 'snippet', action: 'add', id, pid });
    return id;
  }

  async updateSnippet(id: string, updates: Partial<Omit<ISnippetEntityInsert, 'id' | 'type'>>): Promise<void> {
    await this._db
      .update(snippetEntity)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(snippetEntity.id, id));
    const entity = await this.getItemById(id);
    this._changed$.next({ type: 'snippet', action: 'update', id, pid: entity?.pid ?? DEFAULT_SNIPPET_ROOT });
  }

  async deleteSnippet(id: string): Promise<void> {
    const entity = await this.getItemById(id);
    const pid = entity?.pid ?? DEFAULT_SNIPPET_ROOT;
    await this._db.delete(snippetEntity).where(eq(snippetEntity.id, id));
    this._changed$.next({ type: 'snippet', action: 'delete', id, pid });
  }

  async createPackage(record: Omit<ISnippetEntityInsert, 'id' | 'type' | 'tree'> & { id?: string }): Promise<string> {
    const id = record.id || generateId();
    const pid = record.pid || DEFAULT_SNIPPET_ROOT;
    const tree = await this._buildTreePath(id, pid);
    const maxSort = await this._getMaxSortByPid(pid);

    await this._db.insert(snippetEntity).values({
      ...record,
      id,
      pid,
      tree,
      type: SnippetType.PACKAGE,
      sort: record.sort ?? maxSort + 1,
    });
    this._changed$.next({ type: 'package', action: 'add', id, pid });
    return id;
  }

  async updatePackage(id: string, updates: Partial<Omit<ISnippetEntityInsert, 'id' | 'type'>>): Promise<void> {
    await this._db
      .update(snippetEntity)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(snippetEntity.id, id));
    const entity = await this.getItemById(id);
    this._changed$.next({ type: 'package', action: 'update', id, pid: entity?.pid ?? DEFAULT_SNIPPET_ROOT });
  }

  async delete(id: string): Promise<void> {
    const entity = await this.getSnippetById(id);
    if (!entity) {
      return;
    }

    if (entity.type === SnippetType.PACKAGE) {
      await this._deletePackageCascade(id, entity);
    } else {
      await this._deleteSingleSnippet(id, entity);
    }
  }

  async deletePackage(id: string): Promise<void> {
    const entity = await this.getPackageById(id);
    if (!entity) {
      return;
    }
    await this._deletePackageCascade(id, entity);
  }

  async upsertSnippet(record: ISnippetEntityInsert): Promise<string> {
    const existing = await this.getSnippetById(record.id);
    await this._db
      .insert(snippetEntity)
      .values(record)
      .onConflictDoUpdate({
        target: snippetEntity.id,
        set: {
          label: record.label,
          content: record.content,
          description: record.description,
          pid: record.pid,
          tree: record.tree,
          targetHostIds: record.targetHostIds,
          sort: record.sort,
          favorite: record.favorite,
          expanded: record.expanded,
          updatedAt: record.updatedAt,
        },
      });
    const eventType = record.type === SnippetType.PACKAGE ? 'package' : 'snippet';
    this._changed$.next({ type: eventType, action: existing ? 'update' : 'add', id: record.id, pid: record.pid ?? DEFAULT_SNIPPET_ROOT });
    return record.id;
  }

  // --- Move ---

  async move(id: string, targetPid: string, targetSort: number): Promise<void> {
    const entity = await this.getSnippetById(id);
    if (!entity) {
      return;
    }

    const sourcePid = entity.pid;
    const sourceSort = entity.sort;
    const finalTargetPid = targetPid ?? sourcePid;
    const finalTargetSort = targetSort ?? sourceSort;

    if (finalTargetPid === sourcePid && finalTargetSort === sourceSort) {
      return;
    }

    if (finalTargetPid !== sourcePid) {
      await this._moveToDifferentParent(id, entity, sourcePid, sourceSort, finalTargetPid, finalTargetSort);
    } else {
      await this._moveWithinSameParent(id, sourcePid, sourceSort, finalTargetSort);
    }

    const eventType = entity.type === SnippetType.PACKAGE ? 'package' : 'snippet';
    this._changed$.next({ type: eventType, action: 'move', id, pid: finalTargetPid, oldPid: sourcePid });
  }

  // --- Expanded state ---

  async getExpandedPackageIds(): Promise<string[]> {
    const rows = await this._db
      .select({ id: snippetEntity.id })
      .from(snippetEntity)
      .where(and(eq(snippetEntity.type, SnippetType.PACKAGE), eq(snippetEntity.expanded, true)));
    return rows.map((r) => r.id);
  }

  async setExpandedPackageIds(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      this._db.update(snippetEntity)
        .set({ expanded: false })
        .where(and(eq(snippetEntity.type, SnippetType.PACKAGE), eq(snippetEntity.expanded, true)))
        .run();
      return;
    }
    this._db.update(snippetEntity)
      .set({ expanded: true })
      .where(and(eq(snippetEntity.type, SnippetType.PACKAGE), inArray(snippetEntity.id, ids), eq(snippetEntity.expanded, false)))
      .run();
    this._db.update(snippetEntity)
      .set({ expanded: false })
      .where(and(eq(snippetEntity.type, SnippetType.PACKAGE), not(inArray(snippetEntity.id, ids)), eq(snippetEntity.expanded, true)))
      .run();
  }

  override dispose(): void {
    super.dispose();
    this._changed$.complete();
  }

  // --- Private helpers ---

  private _buildTree(rows: ISnippetEntity[], root: string): SnippetTree[] {
    const roots: SnippetTree[] = [];
    const nodeMap = new Map<string, SnippetTree>();

    for (const row of rows) {
      nodeMap.set(row.id, { ...row, children: [] } as unknown as SnippetTree);
    }

    for (const row of rows) {
      const node = nodeMap.get(row.id)!;
      if (row.pid === root) {
        roots.push(node);
      } else {
        const parent = nodeMap.get(row.pid);
        if (parent) {
          parent.children.push(node);
        }
      }
    }

    const sortNodes = (nodes: SnippetTree[]): SnippetTree[] => {
      return nodes
        .sort((a, b) => a.sort - b.sort)
        .map((node) => ({
          ...node,
          children: sortNodes(node.children),
        }));
    };

    return sortNodes(roots);
  }

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
    const res = await this._db.select({ tree: snippetEntity.tree }).from(snippetEntity).where(eq(snippetEntity.id, id));
    if (!res || res.length === 0) {
      throw new Error(`Snippet/package with id ${id} not found`);
    }
    return res[0].tree;
  }

  private async _getMaxSortByPid(pid: string = DEFAULT_SNIPPET_ROOT): Promise<number> {
    const result = await this._db
      .select({ maxSort: snippetEntity.sort })
      .from(snippetEntity)
      .where(eq(snippetEntity.pid, pid))
      .orderBy(desc(snippetEntity.sort))
      .limit(1);
    return result[0]?.maxSort ?? -1;
  }

  private async _deletePackageCascade(id: string, entity: ISnippetEntity): Promise<void> {
    const descendants = await this._db.select().from(snippetEntity).where(
      and(
        not(eq(snippetEntity.id, id)),
        like(snippetEntity.tree, `${entity.tree}%`)
      )
    );

    const removedIds = [id, ...descendants.map((d) => d.id)];

    this._db.transaction((tx) => {
      tx.delete(snippetEntity).where(inArray(snippetEntity.id, removedIds)).run();
      tx.update(snippetEntity).set({ sort: sql`${snippetEntity.sort} - 1` }).where(
        and(eq(snippetEntity.pid, entity.pid), gt(snippetEntity.sort, entity.sort))
      ).run();
    });

    this._changed$.next({ type: 'package', action: 'delete', id, pid: entity.pid });
    for (const d of descendants) {
      const eventType = d.type === SnippetType.PACKAGE ? 'package' as const : 'snippet' as const;
      this._changed$.next({ type: eventType, action: 'delete', id: d.id, pid: d.pid });
    }
  }

  private async _deleteSingleSnippet(id: string, entity: ISnippetEntity): Promise<void> {
    this._db.transaction((tx) => {
      tx.delete(snippetEntity).where(eq(snippetEntity.id, id)).run();
      tx.update(snippetEntity).set({ sort: sql`${snippetEntity.sort} - 1` }).where(
        and(eq(snippetEntity.pid, entity.pid), gt(snippetEntity.sort, entity.sort))
      ).run();
    });
    this._changed$.next({ type: 'snippet', action: 'delete', id, pid: entity.pid });
  }

  private async _moveToDifferentParent(
    id: string,
    entity: ISnippetEntity,
    sourcePid: string,
    sourceSort: number,
    targetPid: string,
    targetSort: number
  ): Promise<void> {
    const targetMaxSort = await this._getMaxSortByPid(targetPid);
    const clampedTargetSort = Math.max(0, Math.min(targetSort, targetMaxSort + 1));

    let newTree = `${DEFAULT_SNIPPET_ROOT}_${id}`;
    if (targetPid !== DEFAULT_SNIPPET_ROOT) {
      const targetTree = await this._getTreeById(targetPid);
      newTree = `${targetTree}_${id}`;
    }
    const oldTree = entity.tree;

    this._db.transaction((tx) => {
      tx
        .update(snippetEntity)
        .set({ sort: sql`${snippetEntity.sort} - 1` })
        .where(and(eq(snippetEntity.pid, sourcePid), gt(snippetEntity.sort, sourceSort)))
        .run();

      tx
        .update(snippetEntity)
        .set({ sort: sql`${snippetEntity.sort} + 1` })
        .where(and(eq(snippetEntity.pid, targetPid), gte(snippetEntity.sort, clampedTargetSort)))
        .run();

      tx
        .update(snippetEntity)
        .set({ pid: targetPid, sort: clampedTargetSort, tree: newTree, updatedAt: new Date().toISOString() })
        .where(eq(snippetEntity.id, id))
        .run();

      this._updateDescendantsTreeSync(tx, id, oldTree, newTree);
    });
  }

  private async _moveWithinSameParent(
    id: string,
    sourcePid: string,
    sourceSort: number,
    targetSort: number
  ): Promise<void> {
    const maxSort = await this._getMaxSortByPid(sourcePid);
    const clampedTargetSort = Math.max(0, Math.min(targetSort, maxSort));

    if (clampedTargetSort === sourceSort) {
      return;
    }

    this._db.transaction((tx) => {
      const sortDirection = clampedTargetSort > sourceSort ? -1 : 1;
      const sortCondition =
        clampedTargetSort > sourceSort
          ? and(eq(snippetEntity.pid, sourcePid), gt(snippetEntity.sort, sourceSort), lte(snippetEntity.sort, clampedTargetSort))
          : and(eq(snippetEntity.pid, sourcePid), lt(snippetEntity.sort, sourceSort), gte(snippetEntity.sort, clampedTargetSort));

      tx
        .update(snippetEntity)
        .set({ sort: sql`${snippetEntity.sort} + ${sortDirection}` })
        .where(sortCondition)
        .run();

      tx
        .update(snippetEntity)
        .set({ sort: clampedTargetSort, updatedAt: new Date().toISOString() })
        .where(eq(snippetEntity.id, id))
        .run();
    });
  }

  private _updateDescendantsTreeSync(
    tx: BetterSQLite3Database<typeof schema>,
    parentId: string,
    oldParentTree: string,
    newParentTree: string
  ): void {
    const descendants = tx.select().from(snippetEntity).where(
      and(
        not(eq(snippetEntity.id, parentId)),
        like(snippetEntity.tree, `${oldParentTree}_%`)
      )
    ).all();

    if (descendants.length === 0) {
      return;
    }

    for (const descendant of descendants) {
      const newTree = newParentTree + descendant.tree.substring(oldParentTree.length);
      tx.update(snippetEntity).set({ tree: newTree, updatedAt: new Date().toISOString() }).where(eq(snippetEntity.id, descendant.id)).run();
    }
  }
}
