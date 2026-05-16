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
import type { IMobileCredential, IMobileHost, IMobileHostFull, IMobileHostSettings, IMobileHostType, IMobileProxy } from './types';
import { base64ToBytes, bytesToBase64 } from '@termlnk/auth';
import { createIdentifier, Disposable, ILogService, Inject } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';
import { IMobileSecretCipherService } from './mobile-secret-cipher.service';
import { IMobileSqliteDatabaseService } from './mobile-sqlite-database.service';

interface IHostRow {
  id: string;
  pid: string;
  tree: string | null;
  label: string;
  type: string;
  addr: string | null;
  port: number | null;
  sort: number;
  credential_ct: string | null;
  proxy_ct: string | null;
  settings_json: string | null;
  host_chain_ids_json: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ISyncMetaRow {
  resource: string;
  cursor: string | null;
}

export interface IMobileHostRepository {
  readonly hosts$: Observable<readonly IMobileHost[]>;
  ready(): Promise<void>;
  upsertFromSync(entity: IMobileHostFull): Promise<void>;
  deleteFromSync(id: string): Promise<void>;
  clearFromSync(): Promise<void>;
  getInfo(id: string): Promise<IMobileHostFull | null>;
  getCursor(resource: string): Promise<string | null>;
  setCursor(resource: string, cursor: string | null): Promise<void>;
}

export const IMobileHostRepository = createIdentifier<IMobileHostRepository>('mobile.host-repository.service');

function rowToHost(row: IHostRow): IMobileHost {
  return {
    id: row.id,
    pid: row.pid,
    tree: row.tree ?? undefined,
    label: row.label,
    type: row.type as IMobileHostType,
    addr: row.addr ?? undefined,
    port: row.port ?? undefined,
    sort: row.sort,
    hasCredential: row.credential_ct !== null,
  };
}

export class MobileHostRepository extends Disposable implements IMobileHostRepository {
  private readonly _hosts$ = new BehaviorSubject<readonly IMobileHost[]>([]);
  readonly hosts$: Observable<readonly IMobileHost[]> = this._hosts$.asObservable();

  private _readyPromise: Promise<void> | null = null;

  // Field declarations are separated from constructor parameters because
  // babel-plugin-parameter-decorator cannot pair a parameter decorator with a TypeScript
  // parameter property — see apps/mobile/babel.config.js.
  private readonly _sqlite: IMobileSqliteDatabaseService;
  private readonly _cipher: IMobileSecretCipherService;
  private readonly _logService: ILogService;

  constructor(
    @Inject(IMobileSqliteDatabaseService) sqlite: IMobileSqliteDatabaseService,
    @Inject(IMobileSecretCipherService) cipher: IMobileSecretCipherService,
    @Inject(ILogService) logService: ILogService
  ) {
    super();
    this._sqlite = sqlite;
    this._cipher = cipher;
    this._logService = logService;
  }

  override dispose(): void {
    super.dispose();
    this._hosts$.complete();
  }

  ready(): Promise<void> {
    if (!this._readyPromise) {
      this._readyPromise = this._refreshHosts();
    }
    return this._readyPromise;
  }

  async upsertFromSync(entity: IMobileHostFull): Promise<void> {
    const db = await this._sqlite.ready();
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

    await db.runAsync(
      `INSERT INTO hosts (
        id, pid, tree, label, type, addr, port, sort,
        credential_ct, proxy_ct, settings_json, host_chain_ids_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        pid = excluded.pid,
        tree = excluded.tree,
        label = excluded.label,
        type = excluded.type,
        addr = excluded.addr,
        port = excluded.port,
        sort = excluded.sort,
        credential_ct = excluded.credential_ct,
        proxy_ct = excluded.proxy_ct,
        settings_json = excluded.settings_json,
        host_chain_ids_json = excluded.host_chain_ids_json,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at`,
      [
        entity.id,
        entity.pid ?? 'root',
        entity.tree ?? null,
        entity.label,
        entity.type,
        entity.addr ?? null,
        entity.port ?? null,
        entity.sort ?? 0,
        credentialCt,
        proxyCt,
        settingsJson,
        chainJson,
        entity.createdAt ?? null,
        entity.updatedAt ?? null,
      ]
    );
    await this._refreshHosts();
  }

  async deleteFromSync(id: string): Promise<void> {
    const db = await this._sqlite.ready();
    await db.runAsync('DELETE FROM hosts WHERE id = ?', [id]);
    await this._refreshHosts();
  }

  async clearFromSync(): Promise<void> {
    const db = await this._sqlite.ready();
    await db.execAsync('DELETE FROM hosts;');
    await this._refreshHosts();
  }

  async getInfo(id: string): Promise<IMobileHostFull | null> {
    const db = await this._sqlite.ready();
    const row = await db.getFirstAsync<IHostRow>('SELECT * FROM hosts WHERE id = ?', [id]);
    if (!row) {
      return null;
    }
    const base = rowToHost(row);
    const credential = await this._tryDecryptField<IMobileCredential>(id, 'credential', row.credential_ct);
    const proxy = await this._tryDecryptField<IMobileProxy>(id, 'proxy', row.proxy_ct);
    const settings: IMobileHostSettings | null = row.settings_json
      ? JSON.parse(row.settings_json)
      : null;
    const hostChainIds = row.host_chain_ids_json
      ? (JSON.parse(row.host_chain_ids_json) as string[])
      : null;
    return {
      ...base,
      credential,
      proxy,
      settings,
      hostChainIds,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    };
  }

  async getCursor(resource: string): Promise<string | null> {
    const db = await this._sqlite.ready();
    const row = await db.getFirstAsync<ISyncMetaRow>(
      'SELECT resource, cursor FROM sync_meta WHERE resource = ?',
      [resource]
    );
    return row?.cursor ?? null;
  }

  async setCursor(resource: string, cursor: string | null): Promise<void> {
    const db = await this._sqlite.ready();
    await db.runAsync(
      `INSERT INTO sync_meta (resource, cursor) VALUES (?, ?)
       ON CONFLICT(resource) DO UPDATE SET cursor = excluded.cursor`,
      [resource, cursor]
    );
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
    const db = await this._sqlite.ready();
    const rows = await db.getAllAsync<IHostRow>(
      'SELECT * FROM hosts ORDER BY sort ASC, id ASC'
    );
    this._hosts$.next(rows.map(rowToHost));
  }
}
