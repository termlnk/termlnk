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

import type { IHostSyncRepository } from '@termlnk/sync';
import type { HostItem, HostTree, IHost, IHostChangeEvent } from '@termlnk/terminal';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../entities';
import type { IHostEntity, IHostEntityInsert } from '../entities';
import { Disposable } from '@termlnk/core';
import { DEFAULT_HOST_ROOT, HOST_CHAIN_MAX_DEPTH, HostType } from '@termlnk/terminal';
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, like, lt, lte, not, sql } from 'drizzle-orm';
import { Subject } from 'rxjs';
import { generateId } from '../entities/base';
import { hostEntity } from '../entities/host';
import { IDBAdaptorService } from '../services/db-adaptor.service';
import { ISecretCipherService } from '../services/secret-cipher.service';
import {
  decryptCredential,
  decryptProxy,
  encryptCredential,
  encryptProxy,
} from '../services/secret-cipher/credential-masker';

export class HostChainCycleError extends Error {
  constructor(public readonly path: string[]) {
    super(`Host chain cycle detected: ${path.join(' -> ')}`);
    this.name = 'HostChainCycleError';
  }
}

export class HostChainDepthError extends Error {
  constructor(public readonly depth: number) {
    super(`Host chain exceeds maximum depth ${HOST_CHAIN_MAX_DEPTH} (got ${depth})`);
    this.name = 'HostChainDepthError';
  }
}

export class HostChainInvalidRefError extends Error {
  constructor(public readonly missingId: string) {
    super(`Host chain id ${missingId} does not reference an existing host`);
    this.name = 'HostChainInvalidRefError';
  }
}

export class HostRepository extends Disposable implements IHostSyncRepository {
  private readonly _changed$ = new Subject<IHostChangeEvent>();
  readonly changed$ = this._changed$.asObservable();

  constructor(
    @IDBAdaptorService private readonly _dbService: IDBAdaptorService,
    @ISecretCipherService private readonly _cipher: ISecretCipherService
  ) {
    super();
  }

  private get _db() {
    return this._dbService.db as BetterSQLite3Database<typeof schema>;
  }

  private _decryptEntity<T extends IHostEntity>(entity: T): T {
    if (!entity) {
      return entity;
    }
    return {
      ...entity,
      credential: decryptCredential(entity.credential, this._cipher),
      proxy: decryptProxy(entity.proxy, this._cipher),
    };
  }

  private _decryptEntities<T extends IHostEntity>(entities: T[]): T[] {
    return entities.map((entity) => this._decryptEntity(entity));
  }

  async getInfoById(id: string): Promise<IHostEntity> {
    const result = await this._db.select().from(hostEntity).where(eq(hostEntity.id, id)).limit(1);
    return result[0] ? this._decryptEntity(result[0]) : result[0];
  }

  async countById(id: string): Promise<number> {
    return this._db.$count(hostEntity, eq(hostEntity.id, id));
  }

  async getListByPid(pid: string = DEFAULT_HOST_ROOT): Promise<HostItem[]> {
    const rows = await this._db.select().from(hostEntity).where(eq(hostEntity.pid, pid)).orderBy(asc(hostEntity.sort));
    return this._decryptEntities(rows);
  }

  async getTree(id: string = DEFAULT_HOST_ROOT): Promise<HostTree[]> {
    if (!id) {
      return [];
    }
    const list = await this._db.select().from(hostEntity).where(like(hostEntity.tree, `${id}%`));

    return this._buildTree(this._decryptEntities(list), id);
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

    const rows = await this._db
      .select()
      .from(hostEntity)
      .where(
        and(
          not(eq(hostEntity.id, id)),
          like(hostEntity.tree, `${treePrefix}%`)
        )
      );
    return this._decryptEntities(rows);
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

    const hostChainIds = this._normalizeHostChainIds(
      (record as Partial<IHost>).hostChainIds
    );
    if (hostChainIds) {
      await this._validateHostChain(id, hostChainIds);
    }

    const partial = record as Partial<IHost>;
    const insertData: IHostEntityInsert = {
      ...record,
      id,
      pid,
      tree,
      sort: maxSort + 1,
      hostChainIds,
      credential: encryptCredential(partial.credential, this._cipher),
      proxy: encryptProxy(partial.proxy, this._cipher),
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

    const partial = record as Partial<IHost>;
    const updatePayload: Partial<IHostEntityInsert> & { updatedAt: string } = {
      ...record,
      updatedAt: new Date().toISOString(),
    };

    // Empty sensitive fields preserve the existing value; the renderer never sees plaintext
    // (sanitized to hasXxx placeholders) and submits "" to mean "unchanged".
    if (Object.hasOwn(record, 'credential')) {
      updatePayload.credential = encryptCredential(
        this._mergeCredentialKeepingOldSecrets(entity.credential, partial.credential),
        this._cipher
      );
    }
    if (Object.hasOwn(record, 'proxy')) {
      updatePayload.proxy = encryptProxy(
        this._mergeProxyKeepingOldSecret(entity.proxy, partial.proxy),
        this._cipher
      );
    }

    if (Object.hasOwn(record, 'hostChainIds')) {
      const normalized = this._normalizeHostChainIds(partial.hostChainIds);
      if (normalized) {
        await this._validateHostChain(entity.id, normalized);
      }
      updatePayload.hostChainIds = normalized;
    }

    await this._db
      .update(hostEntity)
      .set(updatePayload)
      .where(eq(hostEntity.id, entity.id));

    this._emitChange('update', entity.id, entity.pid);
  }

  // Sync-layer entry point: writes a row verbatim (preserves remote tree / sort / pid).
  // Skips chain validation and credential smart-merge — remote rows are always complete,
  // and local rejection would diverge the two ends. Credential / proxy still get re-encrypted
  // because the local cipher is device-bound. Emits changed$ for UI refresh; the sync layer
  // suppresses self-echoes via its own _applyingPatch flag.
  async syncUpsertRow(entity: IHostEntity): Promise<void> {
    const encrypted: IHostEntity = {
      ...entity,
      credential: encryptCredential(entity.credential, this._cipher),
      proxy: encryptProxy(entity.proxy, this._cipher),
    };
    const exists = await this.countById(entity.id);
    if (exists > 0) {
      await this._db.update(hostEntity).set(encrypted).where(eq(hostEntity.id, entity.id));
      this._emitChange('update', entity.id, entity.pid);
    } else {
      await this._db.insert(hostEntity).values(encrypted);
      this._emitChange('add', entity.id, entity.pid);
    }
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
      await this._moveWithinSameParent(id, sourcePid, sourceSort, finalTargetSort);
    }

    const updated = await this.getInfoById(id);
    if (!updated) {
      return;
    }

    this._emitChange('move', updated.id, updated.pid, sourcePid);
  }

  async delete(id: string): Promise<void> {
    const host = await this.getInfoById(id);
    if (!host) {
      return;
    }

    const descendants = await this._db.select().from(hostEntity).where(
      and(
        not(eq(hostEntity.id, id)),
        like(hostEntity.tree, `${host.tree}%`)
      )
    );

    const removedIdSet = new Set<string>([id, ...descendants.map((d) => d.id)]);
    const referrers = await this._findReferrersForIds(removedIdSet);

    await this._db.transaction((tx) => {
      tx.delete(hostEntity).where(inArray(hostEntity.id, [...removedIdSet])).run();

      tx.update(hostEntity).set({ sort: sql`${hostEntity.sort} - 1` }).where(
        and(
          eq(hostEntity.pid, host.pid),
          gt(hostEntity.sort, host.sort)
        )
      ).run();

      const now = new Date().toISOString();
      for (const referrer of referrers) {
        const cleaned = (referrer.hostChainIds ?? []).filter((cid) => !removedIdSet.has(cid));
        const nextValue = cleaned.length === 0 ? null : cleaned;
        tx.update(hostEntity)
          .set({ hostChainIds: nextValue, updatedAt: now })
          .where(eq(hostEntity.id, referrer.id))
          .run();
      }
    });

    this._emitChange('delete', host.id, host.pid);
    descendants.forEach((d) => this._emitChange('delete', d.id, d.pid));
    referrers.forEach((r) => this._emitChange('update', r.id, r.pid));
  }

  /** Hosts that reference `hostId` directly in their host chain. */
  async getReferrers(hostId: string): Promise<IHostEntity[]> {
    const rows = await this._findReferrersForIds(new Set([hostId]));
    return this._decryptEntities(rows);
  }

  // Hosts whose credential references a keychain key or identity. keyId / identityId live
  // in plaintext on the (otherwise masked) credential JSON, so no decryption is needed.
  async findByCredentialRef(kind: 'key' | 'identity', id: string): Promise<IHostEntity[]> {
    const rows = await this._db.select().from(hostEntity).where(eq(hostEntity.type, HostType.HOST));
    return rows.filter((row) => {
      const credential = row.credential;
      if (!credential) {
        return false;
      }
      if (kind === 'key') {
        return credential.type === 'key' && credential.keyId === id;
      }
      return credential.type === 'identity' && credential.identityId === id;
    });
  }

  /**
   * Resolve `owner.hostChainIds` to its ordered hop list, validating cycles, depth and
   * reference integrity. `owner` need not be persisted; only `owner.id` is used for the
   * self-reference check, so callers can pass a transient owner (e.g. test-connection).
   * Returns plaintext credentials because the downstream SSH client requires them.
   */
  async resolveHostChain(owner: Pick<IHost, 'id' | 'hostChainIds'>): Promise<IHost[]> {
    const ids = this._normalizeHostChainIds(owner.hostChainIds);
    if (!ids) {
      return [];
    }
    await this._validateHostChain(owner.id, ids);
    const rows = await this._db.select().from(hostEntity).where(inArray(hostEntity.id, ids));
    const decrypted = this._decryptEntities(rows);
    const byId = new Map(decrypted.map((row) => [row.id, row as IHost]));
    return ids.map((id) => byId.get(id)!);
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

  private _normalizeHostChainIds(ids: string[] | null | undefined): string[] | null {
    if (!ids) {
      return null;
    }
    const cleaned = ids.map((v) => (typeof v === 'string' ? v.trim() : '')).filter((v) => v.length > 0);
    return cleaned.length === 0 ? null : cleaned;
  }

  private async _validateHostChain(ownerId: string, ids: string[]): Promise<void> {
    if (ids.length > HOST_CHAIN_MAX_DEPTH) {
      throw new HostChainDepthError(ids.length);
    }
    const seen = new Set<string>();
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (id === ownerId) {
        throw new HostChainCycleError([ownerId, id]);
      }
      if (seen.has(id)) {
        throw new HostChainCycleError([ownerId, ...ids.slice(0, i + 1)]);
      }
      seen.add(id);
    }
    const rows = await this._db
      .select({ id: hostEntity.id, type: hostEntity.type })
      .from(hostEntity)
      .where(inArray(hostEntity.id, ids));
    const present = new Map(rows.map((r) => [r.id, r.type]));
    for (const id of ids) {
      if (present.get(id) !== HostType.HOST) {
        throw new HostChainInvalidRefError(id);
      }
    }
  }

  private async _findReferrersForIds(ids: Set<string>): Promise<IHostEntity[]> {
    if (ids.size === 0) {
      return [];
    }
    const candidates = await this._db
      .select()
      .from(hostEntity)
      .where(
        and(
          eq(hostEntity.type, HostType.HOST),
          isNotNull(hostEntity.hostChainIds)
        )
      );
    return candidates.filter((row) => {
      const list = row.hostChainIds ?? [];
      return list.some((cid) => ids.has(cid));
    });
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

  private _emitChange(type: IHostChangeEvent['type'], id: string, pid: string, oldPid?: string): void {
    this._changed$.next({ type, id, pid, oldPid });
  }

  // Empty sensitive field on the incoming credential preserves the existing one; otherwise
  // the incoming value wins. A type change (password ↔ rsa) without a fresh secret throws,
  // since the UI must require explicit input.
  private _mergeCredentialKeepingOldSecrets(
    existing: IHostEntity['credential'],
    incoming: IHost['credential'] | null | undefined
  ): IHost['credential'] | null {
    if (incoming == null) {
      return null;
    }
    switch (incoming.type) {
      case 'always':
      case 'identity':
        return incoming;
      case 'password':
        if (incoming.password) {
          return incoming;
        }
        if (existing?.type === 'password') {
          return { ...incoming, password: existing.password };
        }
        throw new Error('[HostRepository] Password credential changed type but no password provided');
      case 'rsa':
        if (incoming.privateKey) {
          return incoming;
        }
        if (existing?.type === 'rsa') {
          return { ...incoming, privateKey: existing.privateKey };
        }
        throw new Error('[HostRepository] RSA credential changed type but no privateKey provided');
      case 'key':
        // passphrase is optional (empty falls back to the key's own); keep the old
        // per-host passphrase when the incoming one is blank.
        if (incoming.passphrase) {
          return incoming;
        }
        if (existing?.type === 'key') {
          return { ...incoming, passphrase: existing.passphrase };
        }
        return incoming;
    }
  }

  // Same empty-keeps-old semantics as _mergeCredentialKeepingOldSecrets, applied to proxy.password.
  private _mergeProxyKeepingOldSecret(
    existing: IHostEntity['proxy'],
    incoming: IHost['proxy'] | null | undefined
  ): IHost['proxy'] | null {
    if (incoming == null) {
      return null;
    }
    if (incoming.password) {
      return incoming;
    }
    if (existing?.password) {
      return { ...incoming, password: existing.password };
    }
    return incoming;
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

    // Resolve the new tree path outside the transaction to keep tx body sync-only.
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
    sourcePid: string,
    sourceSort: number,
    targetSort: number
  ): Promise<void> {
    const maxSort = await this.getMaxSortByParentId(sourcePid);
    const clampedTargetSort = Math.max(0, Math.min(targetSort, maxSort));

    if (clampedTargetSort === sourceSort) {
      return;
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
