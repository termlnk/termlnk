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

import type {
  IIdentitySyncRepository,
  IKnownHostSyncRepository,
  ISshKeySyncRepository,
  ISyncEntityRow,
  ISyncRowChangeEvent,
} from '@termlnk/sync';
import type { Observable } from 'rxjs';
import type {
  IMobileIdentity,
  IMobileIdentityFull,
  IMobileKnownHost,
  IMobileSshKey,
  IMobileSshKeyFull,
  ISshKeyAlgorithm,
  ISshKeySource,
} from './types';
import { base64ToBytes, bytesToBase64 } from '@termlnk/auth';
import { createIdentifier, Disposable, generateRandomId, ILogService, Inject } from '@termlnk/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { IMobileSecretCipherService } from './mobile-secret-cipher.service';
import { IMobileSqliteDatabaseService } from './mobile-sqlite-database.service';

// Keychain repositories (identity / ssh_key / known_host), expo-sqlite-backed. They mirror
// the desktop @termlnk/database entity shapes on the wire so the shared sync engine
// interoperates across clients; secret columns are encrypted at rest by the device cipher
// and re-encrypted under the sync master key for transport by the engine.

function nowIso(): string {
  return new Date().toISOString();
}

// --- Identity ---------------------------------------------------------------------------

interface IIdentitySql {
  id: string;
  label: string;
  username: string | null;
  password_ct: string | null;
  key_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface IMobileIdentityRepository extends IIdentitySyncRepository {
  readonly identities$: Observable<readonly IMobileIdentity[]>;
  ready(): Promise<void>;
  getInfo(id: string): Promise<IMobileIdentityFull | null>;
  createIdentity(input: { label: string; username: string; password?: string; keyId?: string | null }): Promise<string>;
  updateIdentity(input: { id: string; label: string; username: string; password?: string; keyId?: string | null }): Promise<void>;
  deleteIdentity(id: string): Promise<void>;
}

export const IMobileIdentityRepository = createIdentifier<IMobileIdentityRepository>('mobile.identity-repository');

export class MobileIdentityRepository extends Disposable implements IMobileIdentityRepository {
  private readonly _identities$ = new BehaviorSubject<readonly IMobileIdentity[]>([]);
  readonly identities$: Observable<readonly IMobileIdentity[]> = this._identities$.asObservable();

  private readonly _changed$ = new Subject<ISyncRowChangeEvent>();
  readonly changed$: Observable<ISyncRowChangeEvent> = this._changed$.asObservable();

  private _readyPromise: Promise<void> | null = null;

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
    this._identities$.complete();
    this._changed$.complete();
  }

  ready(): Promise<void> {
    if (!this._readyPromise) {
      this._readyPromise = this._refresh();
    }
    return this._readyPromise;
  }

  async getList(): Promise<ISyncEntityRow[]> {
    const db = await this._sqlite.ready();
    const rows = await db.getAllAsync<IIdentitySql>('SELECT * FROM identities');
    return Promise.all(rows.map((r) => this._toSyncRow(r)));
  }

  async getById(id: string): Promise<ISyncEntityRow | null> {
    const db = await this._sqlite.ready();
    const row = await db.getFirstAsync<IIdentitySql>('SELECT * FROM identities WHERE id = ?', [id]);
    return row ? this._toSyncRow(row) : null;
  }

  async syncUpsertRow(entity: ISyncEntityRow): Promise<void> {
    const e = entity as unknown as {
      id: string; label?: string; username?: string; password?: string | null; keyId?: string | null;
      createdAt?: string | null; updatedAt?: string | null;
    };
    await this._persist({
      id: e.id,
      label: e.label ?? '',
      username: e.username ?? '',
      password: e.password ?? null,
      keyId: e.keyId ?? null,
      createdAt: e.createdAt ?? nowIso(),
      updatedAt: e.updatedAt ?? nowIso(),
    });
    await this._refresh();
  }

  async delete(id: string): Promise<void> {
    const db = await this._sqlite.ready();
    await db.runAsync('DELETE FROM identities WHERE id = ?', [id]);
    await this._refresh();
  }

  async getInfo(id: string): Promise<IMobileIdentityFull | null> {
    const db = await this._sqlite.ready();
    const row = await db.getFirstAsync<IIdentitySql>('SELECT * FROM identities WHERE id = ?', [id]);
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      label: row.label,
      username: row.username ?? '',
      keyId: row.key_id,
      hasPassword: row.password_ct !== null,
      password: await this._tryDecrypt(row.id, 'password', row.password_ct),
    };
  }

  async createIdentity(input: { label: string; username: string; password?: string; keyId?: string | null }): Promise<string> {
    const id = generateRandomId(24);
    await this._persist({
      id,
      label: input.label,
      username: input.username,
      password: input.password ?? null,
      keyId: input.keyId ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await this._refresh();
    this._changed$.next({ type: 'add', id });
    return id;
  }

  async updateIdentity(input: { id: string; label: string; username: string; password?: string; keyId?: string | null }): Promise<void> {
    await this._persist({
      id: input.id,
      label: input.label,
      username: input.username,
      password: input.password ?? null,
      keyId: input.keyId ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await this._refresh();
    this._changed$.next({ type: 'update', id: input.id });
  }

  async deleteIdentity(id: string): Promise<void> {
    await this.delete(id);
    this._changed$.next({ type: 'delete', id });
  }

  private async _toSyncRow(row: IIdentitySql): Promise<ISyncEntityRow> {
    const password = await this._tryDecrypt(row.id, 'password', row.password_ct);
    return {
      id: row.id,
      label: row.label,
      username: row.username ?? '',
      password,
      keyId: row.key_id,
      createdAt: row.created_at ?? nowIso(),
      updatedAt: row.updated_at ?? nowIso(),
    } as unknown as ISyncEntityRow;
  }

  private async _persist(v: { id: string; label: string; username: string; password: string | null; keyId: string | null; createdAt: string; updatedAt: string }): Promise<void> {
    const db = await this._sqlite.ready();
    const passwordCt = v.password ? await this._encrypt(v.password) : null;
    await db.runAsync(
      `INSERT INTO identities (id, label, username, password_ct, key_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET label = excluded.label, username = excluded.username,
         password_ct = excluded.password_ct, key_id = excluded.key_id, updated_at = excluded.updated_at`,
      [v.id, v.label, v.username, passwordCt, v.keyId, v.createdAt, v.updatedAt]
    );
  }

  private async _refresh(): Promise<void> {
    const db = await this._sqlite.ready();
    const rows = await db.getAllAsync<IIdentitySql>('SELECT * FROM identities ORDER BY label ASC');
    this._identities$.next(rows.map((r) => ({
      id: r.id,
      label: r.label,
      username: r.username ?? '',
      keyId: r.key_id,
      hasPassword: r.password_ct !== null,
    })));
  }

  private async _encrypt(value: string): Promise<string> {
    return bytesToBase64(await this._cipher.encrypt(new TextEncoder().encode(value)));
  }

  private async _tryDecrypt(id: string, label: string, ct: string | null): Promise<string | null> {
    if (!ct) {
      return null;
    }
    try {
      return new TextDecoder().decode(await this._cipher.decrypt(base64ToBytes(ct)));
    } catch (err) {
      this._logService.warn(`[MobileIdentityRepository] decrypt ${label} for ${id} failed:`, err);
      return null;
    }
  }
}

// --- SSH key ----------------------------------------------------------------------------

interface ISshKeySql {
  id: string;
  label: string;
  algorithm: string | null;
  bits: number | null;
  private_key_ct: string | null;
  public_key: string | null;
  certificate: string | null;
  passphrase_ct: string | null;
  save_passphrase: number;
  source: string | null;
  public_key_fingerprint: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface IMobileSshKeyRepository extends ISshKeySyncRepository {
  readonly keys$: Observable<readonly IMobileSshKey[]>;
  ready(): Promise<void>;
  getInfo(id: string): Promise<IMobileSshKeyFull | null>;
  importKey(input: { label: string; algorithm: ISshKeyAlgorithm; bits?: number | null; privateKey: string; publicKey?: string | null; certificate?: string | null; passphrase?: string | null; savePassphrase: boolean; fingerprint?: string | null; source?: ISshKeySource }): Promise<string>;
  updateKey(input: { id: string; label: string; publicKey?: string | null; privateKey: string; certificate?: string | null; passphrase?: string | null; savePassphrase: boolean }): Promise<void>;
  deleteKey(id: string): Promise<void>;
}

export const IMobileSshKeyRepository = createIdentifier<IMobileSshKeyRepository>('mobile.ssh-key-repository');

export class MobileSshKeyRepository extends Disposable implements IMobileSshKeyRepository {
  private readonly _keys$ = new BehaviorSubject<readonly IMobileSshKey[]>([]);
  readonly keys$: Observable<readonly IMobileSshKey[]> = this._keys$.asObservable();

  private readonly _changed$ = new Subject<ISyncRowChangeEvent>();
  readonly changed$: Observable<ISyncRowChangeEvent> = this._changed$.asObservable();

  private _readyPromise: Promise<void> | null = null;

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
    this._keys$.complete();
    this._changed$.complete();
  }

  ready(): Promise<void> {
    if (!this._readyPromise) {
      this._readyPromise = this._refresh();
    }
    return this._readyPromise;
  }

  async getList(): Promise<ISyncEntityRow[]> {
    const db = await this._sqlite.ready();
    const rows = await db.getAllAsync<ISshKeySql>('SELECT * FROM ssh_keys');
    return Promise.all(rows.map((r) => this._toSyncRow(r)));
  }

  async getById(id: string): Promise<ISyncEntityRow | null> {
    const db = await this._sqlite.ready();
    const row = await db.getFirstAsync<ISshKeySql>('SELECT * FROM ssh_keys WHERE id = ?', [id]);
    return row ? this._toSyncRow(row) : null;
  }

  async syncUpsertRow(entity: ISyncEntityRow): Promise<void> {
    const e = entity as unknown as ISshKeyWire;
    await this._persist(e);
    await this._refresh();
  }

  async syncDeleteRow(id: string): Promise<void> {
    await this.deleteKey(id, true);
  }

  async getInfo(id: string): Promise<IMobileSshKeyFull | null> {
    const db = await this._sqlite.ready();
    const row = await db.getFirstAsync<ISshKeySql>('SELECT * FROM ssh_keys WHERE id = ?', [id]);
    if (!row) {
      return null;
    }
    return {
      ...this._toPublic(row),
      privateKey: (await this._tryDecrypt(row.id, 'privateKey', row.private_key_ct)) ?? '',
      passphrase: await this._tryDecrypt(row.id, 'passphrase', row.passphrase_ct),
    };
  }

  async importKey(input: { label: string; algorithm: ISshKeyAlgorithm; bits?: number | null; privateKey: string; publicKey?: string | null; certificate?: string | null; passphrase?: string | null; savePassphrase: boolean; fingerprint?: string | null; source?: ISshKeySource }): Promise<string> {
    const id = generateRandomId(24);
    await this._persist({
      id,
      label: input.label,
      algorithm: input.algorithm,
      bits: input.bits ?? null,
      privateKey: input.privateKey,
      publicKey: input.publicKey ?? null,
      certificate: input.certificate ?? null,
      passphrase: input.savePassphrase ? input.passphrase ?? null : null,
      savePassphrase: input.savePassphrase,
      source: input.source ?? 'imported',
      publicKeyFingerprint: input.fingerprint ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await this._refresh();
    this._changed$.next({ type: 'add', id });
    return id;
  }

  async updateKey(input: { id: string; label: string; publicKey?: string | null; privateKey: string; certificate?: string | null; passphrase?: string | null; savePassphrase: boolean }): Promise<void> {
    const db = await this._sqlite.ready();
    const existing = await db.getFirstAsync<ISshKeySql>('SELECT * FROM ssh_keys WHERE id = ?', [input.id]);
    await this._persist({
      id: input.id,
      label: input.label,
      algorithm: (existing?.algorithm as ISshKeyAlgorithm) ?? 'ed25519',
      bits: existing?.bits ?? null,
      privateKey: input.privateKey,
      publicKey: input.publicKey ?? existing?.public_key ?? null,
      certificate: input.certificate ?? null,
      passphrase: input.savePassphrase ? input.passphrase ?? null : null,
      savePassphrase: input.savePassphrase,
      source: (existing?.source as ISshKeySource) ?? 'imported',
      publicKeyFingerprint: existing?.public_key_fingerprint ?? null,
      createdAt: existing?.created_at ?? nowIso(),
      updatedAt: nowIso(),
    });
    await this._refresh();
    this._changed$.next({ type: 'update', id: input.id });
  }

  async deleteKey(id: string, suppressEvent = false): Promise<void> {
    const db = await this._sqlite.ready();
    await db.runAsync('DELETE FROM ssh_keys WHERE id = ?', [id]);
    await this._refresh();
    if (!suppressEvent) {
      this._changed$.next({ type: 'delete', id });
    }
  }

  private _toPublic(row: ISshKeySql): IMobileSshKey {
    return {
      id: row.id,
      label: row.label,
      algorithm: (row.algorithm as ISshKeyAlgorithm) ?? 'ed25519',
      bits: row.bits,
      publicKey: row.public_key,
      certificate: row.certificate,
      savePassphrase: row.save_passphrase === 1,
      source: (row.source as ISshKeySource) ?? 'imported',
      publicKeyFingerprint: row.public_key_fingerprint,
      hasPassphrase: row.passphrase_ct !== null,
    };
  }

  private async _toSyncRow(row: ISshKeySql): Promise<ISyncEntityRow> {
    return {
      id: row.id,
      label: row.label,
      algorithm: row.algorithm,
      bits: row.bits,
      privateKey: (await this._tryDecrypt(row.id, 'privateKey', row.private_key_ct)) ?? '',
      publicKey: row.public_key,
      certificate: row.certificate,
      passphrase: await this._tryDecrypt(row.id, 'passphrase', row.passphrase_ct),
      savePassphrase: row.save_passphrase === 1,
      source: row.source,
      publicKeyFingerprint: row.public_key_fingerprint,
      createdAt: row.created_at ?? nowIso(),
      updatedAt: row.updated_at ?? nowIso(),
    } as unknown as ISyncEntityRow;
  }

  private async _persist(v: ISshKeyWire): Promise<void> {
    const db = await this._sqlite.ready();
    const privateKeyCt = v.privateKey ? await this._encrypt(v.privateKey) : null;
    const passphraseCt = v.passphrase ? await this._encrypt(v.passphrase) : null;
    await db.runAsync(
      `INSERT INTO ssh_keys (id, label, algorithm, bits, private_key_ct, public_key, certificate, passphrase_ct, save_passphrase, source, public_key_fingerprint, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET label = excluded.label, algorithm = excluded.algorithm, bits = excluded.bits,
         private_key_ct = excluded.private_key_ct, public_key = excluded.public_key, certificate = excluded.certificate,
         passphrase_ct = excluded.passphrase_ct, save_passphrase = excluded.save_passphrase, source = excluded.source,
         public_key_fingerprint = excluded.public_key_fingerprint, updated_at = excluded.updated_at`,
      [v.id, v.label, v.algorithm ?? null, v.bits ?? null, privateKeyCt, v.publicKey ?? null, v.certificate ?? null, passphraseCt, v.savePassphrase ? 1 : 0, v.source ?? 'imported', v.publicKeyFingerprint ?? null, v.createdAt ?? nowIso(), v.updatedAt ?? nowIso()]
    );
  }

  private async _refresh(): Promise<void> {
    const db = await this._sqlite.ready();
    const rows = await db.getAllAsync<ISshKeySql>('SELECT * FROM ssh_keys ORDER BY label ASC');
    this._keys$.next(rows.map((r) => this._toPublic(r)));
  }

  private async _encrypt(value: string): Promise<string> {
    return bytesToBase64(await this._cipher.encrypt(new TextEncoder().encode(value)));
  }

  private async _tryDecrypt(id: string, label: string, ct: string | null): Promise<string | null> {
    if (!ct) {
      return null;
    }
    try {
      return new TextDecoder().decode(await this._cipher.decrypt(base64ToBytes(ct)));
    } catch (err) {
      this._logService.warn(`[MobileSshKeyRepository] decrypt ${label} for ${id} failed:`, err);
      return null;
    }
  }
}

interface ISshKeyWire {
  id: string;
  label: string;
  algorithm?: string | null;
  bits?: number | null;
  privateKey: string;
  publicKey?: string | null;
  certificate?: string | null;
  passphrase?: string | null;
  savePassphrase: boolean;
  source?: string | null;
  publicKeyFingerprint?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

// --- Known host -------------------------------------------------------------------------

interface IKnownHostSql {
  id: string;
  host: string;
  port: number;
  key_type: string;
  fingerprint: string;
  public_key: string | null;
  last_seen_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface IMobileKnownHostRepository extends IKnownHostSyncRepository {
  readonly knownHosts$: Observable<readonly IMobileKnownHost[]>;
  ready(): Promise<void>;
  upsertKnownHost(input: { host: string; port: number; keyType: string; fingerprint: string; publicKey?: string | null }): Promise<string>;
  deleteKnownHost(id: string): Promise<void>;
}

export const IMobileKnownHostRepository = createIdentifier<IMobileKnownHostRepository>('mobile.known-host-repository');

export class MobileKnownHostRepository extends Disposable implements IMobileKnownHostRepository {
  private readonly _knownHosts$ = new BehaviorSubject<readonly IMobileKnownHost[]>([]);
  readonly knownHosts$: Observable<readonly IMobileKnownHost[]> = this._knownHosts$.asObservable();

  private readonly _changed$ = new Subject<ISyncRowChangeEvent>();
  readonly changed$: Observable<ISyncRowChangeEvent> = this._changed$.asObservable();

  private _readyPromise: Promise<void> | null = null;

  private readonly _sqlite: IMobileSqliteDatabaseService;

  constructor(
    @Inject(IMobileSqliteDatabaseService) sqlite: IMobileSqliteDatabaseService
  ) {
    super();
    this._sqlite = sqlite;
  }

  override dispose(): void {
    super.dispose();
    this._knownHosts$.complete();
    this._changed$.complete();
  }

  ready(): Promise<void> {
    if (!this._readyPromise) {
      this._readyPromise = this._refresh();
    }
    return this._readyPromise;
  }

  async getList(): Promise<ISyncEntityRow[]> {
    const db = await this._sqlite.ready();
    const rows = await db.getAllAsync<IKnownHostSql>('SELECT * FROM known_hosts');
    return rows.map((r) => this._toSyncRow(r));
  }

  async getById(id: string): Promise<ISyncEntityRow | null> {
    const db = await this._sqlite.ready();
    const row = await db.getFirstAsync<IKnownHostSql>('SELECT * FROM known_hosts WHERE id = ?', [id]);
    return row ? this._toSyncRow(row) : null;
  }

  async syncUpsertRow(entity: ISyncEntityRow): Promise<void> {
    const e = entity as unknown as { id: string; host?: string; port?: number; keyType?: string; fingerprint?: string; publicKey?: string | null; lastSeenAt?: string | null; createdAt?: string | null; updatedAt?: string | null };
    await this._persist({
      id: e.id,
      host: e.host ?? '',
      port: e.port ?? 22,
      keyType: e.keyType ?? '',
      fingerprint: e.fingerprint ?? '',
      publicKey: e.publicKey ?? null,
      lastSeenAt: e.lastSeenAt ?? null,
      createdAt: e.createdAt ?? nowIso(),
      updatedAt: e.updatedAt ?? nowIso(),
    });
    await this._refresh();
  }

  async delete(id: string): Promise<void> {
    const db = await this._sqlite.ready();
    await db.runAsync('DELETE FROM known_hosts WHERE id = ?', [id]);
    await this._refresh();
  }

  async upsertKnownHost(input: { host: string; port: number; keyType: string; fingerprint: string; publicKey?: string | null }): Promise<string> {
    const id = `kh_${input.host}_${input.port}_${input.keyType}`.replace(/[^\w]/g, '_');
    await this._persist({
      id,
      host: input.host,
      port: input.port,
      keyType: input.keyType,
      fingerprint: input.fingerprint,
      publicKey: input.publicKey ?? null,
      lastSeenAt: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await this._refresh();
    this._changed$.next({ type: 'add', id });
    return id;
  }

  async deleteKnownHost(id: string): Promise<void> {
    await this.delete(id);
    this._changed$.next({ type: 'delete', id });
  }

  private _toSyncRow(row: IKnownHostSql): ISyncEntityRow {
    return {
      id: row.id,
      host: row.host,
      port: row.port,
      keyType: row.key_type,
      fingerprint: row.fingerprint,
      publicKey: row.public_key,
      lastSeenAt: row.last_seen_at,
      createdAt: row.created_at ?? nowIso(),
      updatedAt: row.updated_at ?? nowIso(),
    } as unknown as ISyncEntityRow;
  }

  private async _persist(v: { id: string; host: string; port: number; keyType: string; fingerprint: string; publicKey: string | null; lastSeenAt: string | null; createdAt: string; updatedAt: string }): Promise<void> {
    const db = await this._sqlite.ready();
    await db.runAsync(
      `INSERT INTO known_hosts (id, host, port, key_type, fingerprint, public_key, last_seen_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET host = excluded.host, port = excluded.port, key_type = excluded.key_type,
         fingerprint = excluded.fingerprint, public_key = excluded.public_key, last_seen_at = excluded.last_seen_at,
         updated_at = excluded.updated_at`,
      [v.id, v.host, v.port, v.keyType, v.fingerprint, v.publicKey, v.lastSeenAt, v.createdAt, v.updatedAt]
    );
  }

  private async _refresh(): Promise<void> {
    const db = await this._sqlite.ready();
    const rows = await db.getAllAsync<IKnownHostSql>('SELECT * FROM known_hosts ORDER BY host ASC');
    this._knownHosts$.next(rows.map((r) => ({
      id: r.id,
      host: r.host,
      port: r.port,
      keyType: r.key_type,
      fingerprint: r.fingerprint,
      publicKey: r.public_key,
      lastSeenAt: r.last_seen_at,
    })));
  }
}
