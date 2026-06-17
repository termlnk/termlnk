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

import type { IHostSyncRepository, ISyncEntityRow, ISyncHostChangeEvent, ISyncHostTreeNode } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import type { IHostEntity } from '../entities/host';
import type { IMobileCredential, IMobileHost, IMobileHostFull, IMobileHostSettings, IMobileHostType, IMobileProxy } from '../types';
import { base64ToBytes, bytesToBase64 } from '@termlnk/auth';
import { createIdentifier, Disposable, ILogService, Inject } from '@termlnk/core';
import { asc, eq, max } from 'drizzle-orm';
import { BehaviorSubject, Subject } from 'rxjs';
import { hostEntity } from '../entities/host';
import { IDatabaseMobileAdaptorService } from './expo-sqlite-adaptor.service';
import { IMobileSecretCipherService } from './mobile-secret-cipher.service';

export interface IMobileHostRepository extends IHostSyncRepository {
  readonly hosts$: Observable<readonly IMobileHost[]>;
  ready(): Promise<void>;
  upsertFromSync(entity: IMobileHostFull): Promise<void>;
  deleteFromSync(id: string): Promise<void>;
  clearFromSync(): Promise<void>;
  getInfo(id: string): Promise<IMobileHostFull | null>;
  // Local CRUD: persists and emits changed$ so the sync engine pushes the change upstream.
  saveHost(entity: IMobileHostFull, opts?: { isNew?: boolean }): Promise<void>;
  removeHost(id: string): Promise<void>;
}

export const IMobileHostRepository = createIdentifier<IMobileHostRepository>('mobile.host-repository.service');

function rowToHost(row: IHostEntity): IMobileHost {
  return {
    id: row.id,
    pid: row.pid,
    tree: row.tree ?? undefined,
    label: row.label,
    type: row.type as IMobileHostType,
    addr: row.addr ?? undefined,
    port: row.port ?? undefined,
    sort: row.sort,
    hasCredential: row.credentialCt !== null,
  };
}

// The sync engine serializes the returned object as the E2EE payload, so it must carry the
// desktop IHostEntity field shape (credential / proxy inline) for cross-client interop.
// `hasCredential` is a mobile-only view flag and is intentionally dropped.
function toSyncRow(full: IMobileHostFull): ISyncEntityRow {
  return {
    id: full.id,
    pid: full.pid,
    tree: full.tree ?? null,
    label: full.label,
    type: full.type,
    addr: full.addr ?? null,
    port: full.port ?? null,
    sort: full.sort ?? 0,
    credential: full.credential ?? null,
    proxy: full.proxy ?? null,
    settings: full.settings ?? null,
    hostChainIds: full.hostChainIds ?? null,
    createdAt: full.createdAt ?? null,
    updatedAt: full.updatedAt ?? null,
  } as unknown as ISyncEntityRow;
}

export class MobileHostRepository extends Disposable implements IMobileHostRepository, IHostSyncRepository {
  private readonly _hosts$ = new BehaviorSubject<readonly IMobileHost[]>([]);
  readonly hosts$: Observable<readonly IMobileHost[]> = this._hosts$.asObservable();

  // Drives the sync engine's push path. Emitted only by local CRUD (saveHost / removeHost)
  // — never from syncUpsertRow / delete (those apply server patches and would otherwise
  // echo back).
  private readonly _changed$ = new Subject<ISyncHostChangeEvent>();
  readonly changed$: Observable<ISyncHostChangeEvent> = this._changed$.asObservable();

  private _readyPromise: Promise<void> | null = null;

  private readonly _adaptor: IDatabaseMobileAdaptorService;
  private readonly _cipher: IMobileSecretCipherService;
  private readonly _logService: ILogService;

  constructor(
    @Inject(IDatabaseMobileAdaptorService) adaptor: IDatabaseMobileAdaptorService,
    @Inject(IMobileSecretCipherService) cipher: IMobileSecretCipherService,
    @Inject(ILogService) logService: ILogService
  ) {
    super();
    this._adaptor = adaptor;
    this._cipher = cipher;
    this._logService = logService;
  }

  override dispose(): void {
    super.dispose();
    this._hosts$.complete();
    this._changed$.complete();
  }

  ready(): Promise<void> {
    if (!this._readyPromise) {
      this._readyPromise = this._refreshHosts();
    }
    return this._readyPromise;
  }

  async upsertFromSync(entity: IMobileHostFull): Promise<void> {
    const db = await this._adaptor.ready();
    const credentialCt = entity.credential
      ? await this._encryptJson(entity.credential)
      : null;
    const proxyCt = entity.proxy
      ? await this._encryptJson(entity.proxy)
      : null;
    const settingsJson = entity.settings ? JSON.stringify(entity.settings) : null;
    const chainJson = entity.hostChainIds && entity.hostChainIds.length > 0
      ? JSON.stringify(entity.hostChainIds)
      : null;
    const createdAt = entity.createdAt ?? new Date().toISOString();
    const updatedAt = entity.updatedAt ?? new Date().toISOString();

    db.insert(hostEntity)
      .values({
        id: entity.id,
        pid: entity.pid ?? 'root',
        tree: entity.tree ?? null,
        label: entity.label,
        type: entity.type,
        addr: entity.addr ?? null,
        port: entity.port ?? null,
        sort: entity.sort ?? 0,
        credentialCt,
        proxyCt,
        settingsJson,
        hostChainIdsJson: chainJson,
        createdAt,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: hostEntity.id,
        set: {
          pid: entity.pid ?? 'root',
          tree: entity.tree ?? null,
          label: entity.label,
          type: entity.type,
          addr: entity.addr ?? null,
          port: entity.port ?? null,
          sort: entity.sort ?? 0,
          credentialCt,
          proxyCt,
          settingsJson,
          hostChainIdsJson: chainJson,
          updatedAt,
        },
      })
      .run();
    await this._refreshHosts();
  }

  async deleteFromSync(id: string): Promise<void> {
    const db = await this._adaptor.ready();
    db.delete(hostEntity).where(eq(hostEntity.id, id)).run();
    await this._refreshHosts();
  }

  async clearFromSync(): Promise<void> {
    const db = await this._adaptor.ready();
    db.delete(hostEntity).run();
    await this._refreshHosts();
  }

  async getInfo(id: string): Promise<IMobileHostFull | null> {
    const db = await this._adaptor.ready();
    const row = db.select().from(hostEntity).where(eq(hostEntity.id, id)).get();
    if (!row) {
      return null;
    }
    const base = rowToHost(row);
    const credential = await this._tryDecryptField<IMobileCredential>(id, 'credential', row.credentialCt);
    const proxy = await this._tryDecryptField<IMobileProxy>(id, 'proxy', row.proxyCt);
    const settings: IMobileHostSettings | null = row.settingsJson
      ? JSON.parse(row.settingsJson)
      : null;
    const hostChainIds = row.hostChainIdsJson
      ? (JSON.parse(row.hostChainIdsJson) as string[])
      : null;
    return {
      ...base,
      credential,
      proxy,
      settings,
      hostChainIds,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // --- IHostSyncRepository (sync engine push/pull path) ---

  async getTree(): Promise<ISyncHostTreeNode[]> {
    const db = await this._adaptor.ready();
    const rows = db.select({ id: hostEntity.id, pid: hostEntity.pid })
      .from(hostEntity)
      .orderBy(asc(hostEntity.sort), asc(hostEntity.id))
      .all();
    const nodes = new Map<string, ISyncHostTreeNode & { children: ISyncHostTreeNode[] }>();
    for (const r of rows) {
      nodes.set(r.id, { id: r.id, children: [] });
    }
    const roots: ISyncHostTreeNode[] = [];
    for (const r of rows) {
      const node = nodes.get(r.id)!;
      const parent = nodes.get(r.pid);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async getInfoById(id: string): Promise<ISyncEntityRow | null> {
    const full = await this.getInfo(id);
    return full ? toSyncRow(full) : null;
  }

  // Incoming server patch: the decrypted payload structurally matches IMobileHostFull
  // (credential/proxy inline); upsertFromSync re-encrypts secrets under the device cipher.
  async syncUpsertRow(entity: ISyncEntityRow): Promise<void> {
    await this.upsertFromSync(entity as unknown as IMobileHostFull);
  }

  async delete(id: string): Promise<void> {
    await this.deleteFromSync(id);
  }

  // --- Local CRUD (emits changed$ → sync engine push) ---

  // Persist a locally created/edited host or group, then notify the sync engine. Distinct
  // from syncUpsertRow (which applies server patches and must stay silent to avoid echo).
  // Computes a non-null `tree` path (rooted at "root") and a sibling `sort` so the row
  // satisfies the desktop schema (host.tree NOT NULL) and stays visible/ordered on desktop,
  // which builds its tree with `LIKE 'root%'`.
  async saveHost(entity: IMobileHostFull, opts?: { isNew?: boolean }): Promise<void> {
    const tree = entity.tree ?? await this._computeTree(entity.pid, entity.id);
    const sort = entity.sort ?? (opts?.isNew ? await this._nextSort(entity.pid) : 0);
    await this.upsertFromSync({ ...entity, tree, sort });
    this._changed$.next({ type: opts?.isNew ? 'add' : 'update', id: entity.id });
  }

  async removeHost(id: string): Promise<void> {
    await this.deleteFromSync(id);
    this._changed$.next({ type: 'delete', id });
  }

  // Path tree mirrors the desktop convention: `<parentTree>_<id>`, with the virtual root
  // contributing the literal "root" segment. String ids (vs desktop's numeric ones) are
  // fine — the tree is only ever used as a LIKE-prefix for descendant queries.
  private async _computeTree(pid: string, id: string): Promise<string> {
    if (pid === 'root' || pid === '') {
      return `root_${id}`;
    }
    const db = await this._adaptor.ready();
    const row = db.select({ tree: hostEntity.tree }).from(hostEntity).where(eq(hostEntity.id, pid)).get();
    const parentTree = row?.tree ?? 'root';
    return `${parentTree}_${id}`;
  }

  private async _nextSort(pid: string): Promise<number> {
    const db = await this._adaptor.ready();
    const row = db.select({ m: max(hostEntity.sort) }).from(hostEntity).where(eq(hostEntity.pid, pid)).get();
    return (row?.m ?? -1) + 1;
  }

  private async _encryptJson(value: unknown): Promise<string> {
    const plaintext = new TextEncoder().encode(JSON.stringify(value));
    const frame = await this._cipher.encrypt(plaintext);
    return bytesToBase64(frame);
  }

  private async _decryptJson<T>(b64: string): Promise<T> {
    const frame = base64ToBytes(b64);
    const plaintext = await this._cipher.decrypt(frame);
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  }

  // Decrypt failures are non-fatal: a corrupted blob surfaces as a missing secret,
  // which falls back to the manual-credential entry path on the consumer screens.
  private async _tryDecryptField<T>(id: string, label: string, b64: string | null): Promise<T | null> {
    if (!b64) {
      return null;
    }
    try {
      return await this._decryptJson<T>(b64);
    } catch (err) {
      this._logService.warn(`[MobileHostRepository] failed to decrypt ${label} for ${id}:`, err);
      return null;
    }
  }

  private async _refreshHosts(): Promise<void> {
    const db = await this._adaptor.ready();
    const rows = db.select()
      .from(hostEntity)
      .orderBy(asc(hostEntity.sort), asc(hostEntity.id))
      .all();
    this._hosts$.next(rows.map(rowToHost));
  }
}
