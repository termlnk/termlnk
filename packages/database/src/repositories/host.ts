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

import type { HostItem, HostTree, IHostChangeEvent } from '@termlnk/terminal';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../entities';
import type { IHostEntity, IHostEntityInsert } from '../entities';
import { Disposable } from '@termlnk/core';
import { DEFAULT_HOST_ROOT, HostType } from '@termlnk/terminal';
import { and, asc, desc, eq, gt, gte, inArray, like, lt, lte, not, sql } from 'drizzle-orm';
import { Subject } from 'rxjs';
import { generateId } from '../entities/base';
import { hostEntity } from '../entities/host';
import { IDBAdaptorService } from '../services/db-adaptor.service';

export class HostRepository extends Disposable {
  private readonly _changed$ = new Subject<IHostChangeEvent>();
  readonly changed$ = this._changed$.asObservable();

  constructor(
    @IDBAdaptorService private readonly _dbService: IDBAdaptorService
  ) {
    super();
  }

  private get _db() {
    return this._dbService.db as BetterSQLite3Database<typeof schema>;
  }

  async getInfoById(id: string): Promise<IHostEntity> {
    const result = await this._db.select().from(hostEntity).where(eq(hostEntity.id, id)).limit(1);
    return result[0];
  }

  async countById(id: string): Promise<number> {
    return this._db.$count(hostEntity, eq(hostEntity.id, id));
  }

  async getListByPid(pid: string = DEFAULT_HOST_ROOT): Promise<HostItem[]> {
    return this._db.select().from(hostEntity).where(eq(hostEntity.pid, pid)).orderBy(asc(hostEntity.sort));
  }

  async getTree(id: string = DEFAULT_HOST_ROOT): Promise<HostTree[]> {
    if (!id) {
      return [];
    }
    const list = await this._db.select().from(hostEntity).where(like(hostEntity.tree, `${id}%`));

    return this._buildTree(list, id);
  }

  private _buildTree(hosts: IHostEntity[], root: string): HostTree[] {
    const roots: HostTree[] = [];

    const nodeMap = new Map<string, HostTree>();
    for (const host of hosts) {
      nodeMap.set(host.id, { ...host, children: [] });
    }

    for (const host of hosts) {
      const node = nodeMap.get(host.id)!;
      if (host.pid === root) {
        roots.push(node);
      } else {
        const parent = nodeMap.get(host.pid);
        if (parent) {
          parent.children.push(node);
        }
      }
    }

    const sortNodes = (nodes: HostTree[]): HostTree[] => {
      return nodes
        .sort((a, b) => a.sort - b.sort)
        .map((node) => ({
          ...node,
          children: sortNodes(node.children),
        }));
    };

    return sortNodes(roots);
  }

  async getDescendants(id: string): Promise<IHostEntity[]> {
    const parent = await this.getInfoById(id);
    if (!parent) {
      return [];
    }

    const treePrefix = await this._getTreeById(id);

    return this._db
      .select()
      .from(hostEntity)
      .where(
        and(
          not(eq(hostEntity.id, id)),
          like(hostEntity.tree, `${treePrefix}%`)
        )
      );
  }

  async getMaxSortByParentId(parentId: string = DEFAULT_HOST_ROOT): Promise<number> {
    const result = await this._db
      .select({ maxSort: hostEntity.sort })
      .from(hostEntity)
      .where(eq(hostEntity.pid, parentId))
      .orderBy(desc(hostEntity.sort))
      .limit(1);

    return result[0]?.maxSort ?? -1;
  }

  async create(record: Pick<HostItem, 'label' | 'type'> & Partial<Omit<HostItem, 'label' | 'type' | 'sort'>>): Promise<string> {
    const id = record?.id || generateId(8);

    const existing = await this.countById(id);
    if (existing > 0) {
      throw new Error(`Host with id ${id} already exists`);
    }

    const pid = record?.pid || DEFAULT_HOST_ROOT;
    let tree = `${DEFAULT_HOST_ROOT}_${id}`;
    if (pid !== DEFAULT_HOST_ROOT) {
      const parentTree = await this._getTreeById(pid);
      tree = `${parentTree}_${id}`;
    }

    const maxSort = await this.getMaxSortByParentId(pid);

    const insertData: IHostEntityInsert = {
      ...record,
      id,
      pid,
      tree,
      sort: maxSort + 1,
    };
    await this._db.insert(hostEntity).values(insertData);

    this._emitChange('add', id, pid);
    return id;
  }

  async update(record: Pick<HostItem, 'id' | 'label' | 'type'> & Partial<Omit<HostItem, 'label' | 'type' | 'sort'>>): Promise<void> {
    const entity = await this.getInfoById(record.id);
    if (!entity) {
      return;
    }

    await this._db
      .update(hostEntity)
      .set({ ...record, updatedAt: new Date().toISOString() })
      .where(eq(hostEntity.id, entity.id));

    this._emitChange('update', entity.id, entity.pid);
  }

  async move(id: string, targetPid: string, targetSort: number): Promise<void> {
    const host = await this.getInfoById(id);
    if (!host) return undefined;

    const sourcePid = host.pid;
    const sourceSort = host.sort;
    const finalTargetPid = targetPid ?? sourcePid;
    const finalTargetSort = targetSort ?? sourceSort;

    if (finalTargetPid === sourcePid && finalTargetSort === sourceSort) {
      return;
    }

    if (finalTargetPid !== sourcePid) {
      await this._moveToDifferentParent(id, host, sourcePid, sourceSort, finalTargetPid, finalTargetSort);
    } else {
      await this._moveWithinSameParent(id, host, sourcePid, sourceSort, finalTargetSort);
    }

    const updated = await this.getInfoById(id);
    if (!updated) {
      return;
    }

    this._emitChange('move', updated.id, updated.pid);
  }

  async delete(id: string): Promise<void> {
    const host = await this.getInfoById(id);
    if (!host) {
      return;
    }

    // 获取所有子节点
    const descendants = await this._db.select().from(hostEntity).where(
      and(
        not(eq(hostEntity.id, id)),
        like(hostEntity.tree, `${host.tree}%`)
      )
    );

    await this._db.transaction((tx) => {
      const childrenIds = [id, ...descendants.map((d) => d.id)];
      tx.delete(hostEntity).where(inArray(hostEntity.id, childrenIds)).run();

      tx.update(hostEntity).set({ sort: sql`${hostEntity.sort} - 1` }).where(
        and(
          eq(hostEntity.pid, host.pid),
          gt(hostEntity.sort, host.sort)
        )
      ).run();
    });

    this._emitChange('delete', host.id, host.pid);
    descendants.forEach((d) => this._emitChange('delete', d.id, d.pid));
  }

  async getExpandedIds(): Promise<string[]> {
    const rows = await this._db
      .select({ id: hostEntity.id })
      .from(hostEntity)
      .where(
        and(
          eq(hostEntity.type, HostType.GROUP),
          eq(hostEntity.expanded, true)
        )
      );

    return rows.map((row) => row.id);
  }

  async setExpandedIds(ids: string[]): Promise<void> {
    await this._db.update(hostEntity).set({ expanded: false, updatedAt: new Date().toISOString() }).where(eq(hostEntity.type, HostType.GROUP));
    if (ids.length === 0) {
      return;
    }

    await this._db.update(hostEntity).set({ expanded: true, updatedAt: new Date().toISOString() }).where(and(eq(hostEntity.type, HostType.GROUP), inArray(hostEntity.id, ids)));
  }

  async copy(id: string): Promise<string> {
    const host = await this.getInfoById(id);
    if (!host) {
      throw new Error(`Host with id ${id} not found`);
    }
    if (host.type === HostType.GROUP) {
      throw new Error('Cannot copy group');
    }

    const newId = generateId(8);
    const insertData: Omit<HostItem, 'sort' | 'tree'> = {
      ...host,
      id: newId,
      label: `${host.label} Copy`,
    };
    return this.create(insertData);
  }

  private async _getTreeById(id: string): Promise<string> {
    if (id === DEFAULT_HOST_ROOT || id === '') {
      return DEFAULT_HOST_ROOT;
    }

    const res = await this._db.select({ tree: hostEntity.tree }).from(hostEntity).where(eq(hostEntity.id, id));
    if (!res || res.length === 0) {
      throw new Error(`Parent host with id ${id} not found`);
    }

    return res[0].tree;
  }

  private _emitChange(type: IHostChangeEvent['type'], id: string, pid: string): void {
    this._changed$.next({ type, id, pid });
  }

  private async _moveToDifferentParent(
    id: string,
    host: IHostEntity,
    sourcePid: string,
    sourceSort: number,
    targetPid: string,
    targetSort: number
  ): Promise<void> {
    const targetMaxSort = await this.getMaxSortByParentId(targetPid);
    const clampedTargetSort = Math.max(0, Math.min(targetSort, targetMaxSort + 1));

    // 在事务外查询 tree 路径
    let newTree = `${DEFAULT_HOST_ROOT}_${id}`;
    if (targetPid !== DEFAULT_HOST_ROOT) {
      const targetTree = await this._getTreeById(targetPid);
      newTree = `${targetTree}_${id}`;
    }
    const oldTree = host.tree;

    this._db.transaction((tx) => {
      tx
        .update(hostEntity)
        .set({ sort: sql`${hostEntity.sort} - 1` })
        .where(and(eq(hostEntity.pid, sourcePid), gt(hostEntity.sort, sourceSort)))
        .run();

      tx
        .update(hostEntity)
        .set({ sort: sql`${hostEntity.sort} + 1` })
        .where(and(eq(hostEntity.pid, targetPid), gte(hostEntity.sort, clampedTargetSort)))
        .run();

      tx
        .update(hostEntity)
        .set({ pid: targetPid, sort: clampedTargetSort, tree: newTree, updatedAt: new Date().toISOString() })
        .where(eq(hostEntity.id, id))
        .run();

      this._updateDescendantsTreeSync(tx, id, oldTree, newTree);
    });
  }

  private async _moveWithinSameParent(
    id: string,
    _host: IHostEntity,
    sourcePid: string,
    sourceSort: number,
    targetSort: number
  ): Promise<IHostEntity | undefined> {
    const maxSort = await this.getMaxSortByParentId(sourcePid);
    const clampedTargetSort = Math.max(0, Math.min(targetSort, maxSort));

    if (clampedTargetSort === sourceSort) {
      return _host;
    }

    this._db.transaction((tx) => {
      const sortDirection = clampedTargetSort > sourceSort ? -1 : 1;
      const sortCondition =
        clampedTargetSort > sourceSort
          ? and(eq(hostEntity.pid, sourcePid), gt(hostEntity.sort, sourceSort), lte(hostEntity.sort, clampedTargetSort))
          : and(eq(hostEntity.pid, sourcePid), lt(hostEntity.sort, sourceSort), gte(hostEntity.sort, clampedTargetSort));

      tx
        .update(hostEntity)
        .set({ sort: sql`${hostEntity.sort} + ${sortDirection}` })
        .where(sortCondition)
        .run();

      tx
        .update(hostEntity)
        .set({ sort: clampedTargetSort, updatedAt: new Date().toISOString() })
        .where(eq(hostEntity.id, id))
        .run();
    });

    return undefined;
  }

  private _updateDescendantsTreeSync(
    tx: BetterSQLite3Database<typeof schema>,
    parentId: string,
    oldParentTree: string,
    newParentTree: string
  ): void {
    const descendants = tx.select().from(hostEntity).where(
      and(
        not(eq(hostEntity.id, parentId)),
        like(hostEntity.tree, `${oldParentTree}_%`)
      )
    ).all();

    if (descendants.length === 0) return;

    for (const descendant of descendants) {
      const newTree = newParentTree + descendant.tree.substring(oldParentTree.length);
      tx.update(hostEntity).set({ tree: newTree, updatedAt: new Date().toISOString() }).where(eq(hostEntity.id, descendant.id)).run();
    }
  }
}
