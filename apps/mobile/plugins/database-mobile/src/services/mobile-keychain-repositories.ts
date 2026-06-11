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

import type { IIdentitySyncRepository, IKnownHostSyncRepository, ISshKeySyncRepository, ISyncEntityRow, ISyncRowChangeEvent } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import type { IIdentityEntity } from '../entities/identity';
import type { IKnownHostEntity } from '../entities/known-host';
import type { ISshKeyEntity } from '../entities/ssh-key';
import type { IMobileIdentity, IMobileIdentityFull, IMobileKnownHost, IMobileSshKey, IMobileSshKeyFull, ISshKeyAlgorithm, ISshKeySource } from '../types';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { base64ToBytes, bytesToBase64 } from '@termlnk/auth';
import { createIdentifier, Disposable, generateRandomId, ILogService, Inject } from '@termlnk/core';
import { asc, eq } from 'drizzle-orm';
import { BehaviorSubject, Subject } from 'rxjs';
import { identityEntity } from '../entities/identity';
import { knownHostEntity } from '../entities/known-host';
import { sshKeyEntity } from '../entities/ssh-key';
import { IDatabaseMobileAdaptorService } from './expo-sqlite-adaptor.service';
import { IMobileSecretCipherService } from './mobile-secret-cipher.service';

// Keychain repositories (identity / ssh_key / known_host) backed by drizzle. They mirror
// the desktop @termlnk/database entity shapes on the wire so the shared sync engine
// interoperates across clients; secret columns are encrypted at rest by the device cipher
// and re-encrypted under the sync master key for transport by the engine.

function nowIso(): string {
  return new Date().toISOString();
}

// --- Identity ----------------------------------------------------------------------------

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
    const db = await this._adaptor.ready();
    const rows = db.select().from(identityEntity).all();
    return Promise.all(rows.map((r) => this._toSyncRow(r)));
  }

  async getById(id: string): Promise<ISyncEntityRow | null> {
    const db = await this._adaptor.ready();
    const row = db.select().from(identityEntity).where(eq(identityEntity.id, id)).get();
    return row ? this._toSyncRow(row) : null;
  }

  async syncUpsertRow(entity: ISyncEntityRow): Promise<void> {
    const e = entity as unknown as {
      id: string;
      label?: string;
      username?: string;
      password?: string | null;
      keyId?: string | null;
      createdAt?: string | null;
      updatedAt?: string | null;
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
    const db = await this._adaptor.ready();
    db.delete(identityEntity).where(eq(identityEntity.id, id)).run();
    await this._refresh();
  }

  async getInfo(id: string): Promise<IMobileIdentityFull | null> {
    const db = await this._adaptor.ready();
    const row = db.select().from(identityEntity).where(eq(identityEntity.id, id)).get();
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      label: row.label,
      username: row.username ?? '',
      keyId: row.keyId,
      hasPassword: row.passwordCt !== null,
      password: await this._tryDecrypt(row.id, 'password', row.passwordCt),
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

  private async _toSyncRow(row: IIdentityEntity): Promise<ISyncEntityRow> {
    const password = await this._tryDecrypt(row.id, 'password', row.passwordCt);
    return {
      id: row.id,
      label: row.label,
      username: row.username ?? '',
      password,
      keyId: row.keyId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } as unknown as ISyncEntityRow;
  }

  private async _persist(v: { id: string; label: string; username: string; password: string | null; keyId: string | null; createdAt: string; updatedAt: string }): Promise<void> {
    const db = await this._adaptor.ready();
    const passwordCt = v.password ? await this._encrypt(v.password) : null;
    db.insert(identityEntity)
      .values({
        id: v.id,
        label: v.label,
        username: v.username,
        passwordCt,
        keyId: v.keyId,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      })
      .onConflictDoUpdate({
        target: identityEntity.id,
        set: {
          label: v.label,
          username: v.username,
          passwordCt,
          keyId: v.keyId,
          updatedAt: v.updatedAt,
        },
      })
      .run();
  }

  private async _refresh(): Promise<void> {
    const db = await this._adaptor.ready();
    const rows = db.select().from(identityEntity).orderBy(asc(identityEntity.label)).all();
    this._identities$.next(rows.map((r) => ({
      id: r.id,
      label: r.label,
      username: r.username ?? '',
      keyId: r.keyId,
      hasPassword: r.passwordCt !== null,
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

// --- SSH key -----------------------------------------------------------------------------

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
    const db = await this._adaptor.ready();
    const rows = db.select().from(sshKeyEntity).all();
    return Promise.all(rows.map((r) => this._toSyncRow(r)));
  }

  async getById(id: string): Promise<ISyncEntityRow | null> {
    const db = await this._adaptor.ready();
    const row = db.select().from(sshKeyEntity).where(eq(sshKeyEntity.id, id)).get();
    return row ? this._toSyncRow(row) : null;
  }

  async syncUpsertRow(entity: ISyncEntityRow): Promise<void> {
    await this._persist(entity as unknown as ISshKeyWire);
    await this._refresh();
  }

  async syncDeleteRow(id: string): Promise<void> {
    await this.deleteKey(id, true);
  }

  async getInfo(id: string): Promise<IMobileSshKeyFull | null> {
    const db = await this._adaptor.ready();
    const row = db.select().from(sshKeyEntity).where(eq(sshKeyEntity.id, id)).get();
    if (!row) {
      return null;
    }
    return {
      ...this._toPublic(row),
      privateKey: (await this._tryDecrypt(row.id, 'privateKey', row.privateKeyCt)) ?? '',
      passphrase: await this._tryDecrypt(row.id, 'passphrase', row.passphraseCt),
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
    const db = await this._adaptor.ready();
    const existing = db.select().from(sshKeyEntity).where(eq(sshKeyEntity.id, input.id)).get();
    await this._persist({
      id: input.id,
      label: input.label,
      algorithm: (existing?.algorithm as ISshKeyAlgorithm) ?? 'ed25519',
      bits: existing?.bits ?? null,
      privateKey: input.privateKey,
      publicKey: input.publicKey ?? existing?.publicKey ?? null,
      certificate: input.certificate ?? null,
      passphrase: input.savePassphrase ? input.passphrase ?? null : null,
      savePassphrase: input.savePassphrase,
      source: (existing?.source as ISshKeySource) ?? 'imported',
      publicKeyFingerprint: existing?.publicKeyFingerprint ?? null,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    });
    await this._refresh();
    this._changed$.next({ type: 'update', id: input.id });
  }

  async deleteKey(id: string, suppressEvent = false): Promise<void> {
    const db = await this._adaptor.ready();
    db.delete(sshKeyEntity).where(eq(sshKeyEntity.id, id)).run();
    await this._refresh();
    if (!suppressEvent) {
      this._changed$.next({ type: 'delete', id });
    }
  }

  private _toPublic(row: ISshKeyEntity): IMobileSshKey {
    return {
      id: row.id,
      label: row.label,
      algorithm: (row.algorithm as ISshKeyAlgorithm) ?? 'ed25519',
      bits: row.bits,
      publicKey: row.publicKey,
      certificate: row.certificate,
      savePassphrase: row.savePassphrase,
      source: (row.source as ISshKeySource) ?? 'imported',
      publicKeyFingerprint: row.publicKeyFingerprint,
      hasPassphrase: row.passphraseCt !== null,
    };
  }

  private async _toSyncRow(row: ISshKeyEntity): Promise<ISyncEntityRow> {
    return {
      id: row.id,
      label: row.label,
      algorithm: row.algorithm,
      bits: row.bits,
      privateKey: (await this._tryDecrypt(row.id, 'privateKey', row.privateKeyCt)) ?? '',
      publicKey: row.publicKey,
      certificate: row.certificate,
      passphrase: await this._tryDecrypt(row.id, 'passphrase', row.passphraseCt),
      savePassphrase: row.savePassphrase,
      source: row.source,
      publicKeyFingerprint: row.publicKeyFingerprint,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } as unknown as ISyncEntityRow;
  }

  private async _persist(v: ISshKeyWire): Promise<void> {
    const db = await this._adaptor.ready();
    const privateKeyCt = v.privateKey ? await this._encrypt(v.privateKey) : null;
    const passphraseCt = v.passphrase ? await this._encrypt(v.passphrase) : null;
    const createdAt = v.createdAt ?? nowIso();
    const updatedAt = v.updatedAt ?? nowIso();
    db.insert(sshKeyEntity)
      .values({
        id: v.id,
        label: v.label,
        algorithm: v.algorithm ?? null,
        bits: v.bits ?? null,
        privateKeyCt,
        publicKey: v.publicKey ?? null,
        certificate: v.certificate ?? null,
        passphraseCt,
        savePassphrase: v.savePassphrase,
        source: v.source ?? 'imported',
        publicKeyFingerprint: v.publicKeyFingerprint ?? null,
        createdAt,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: sshKeyEntity.id,
        set: {
          label: v.label,
          algorithm: v.algorithm ?? null,
          bits: v.bits ?? null,
          privateKeyCt,
          publicKey: v.publicKey ?? null,
          certificate: v.certificate ?? null,
          passphraseCt,
          savePassphrase: v.savePassphrase,
          source: v.source ?? 'imported',
          publicKeyFingerprint: v.publicKeyFingerprint ?? null,
          updatedAt,
        },
      })
      .run();
  }

  private async _refresh(): Promise<void> {
    const db = await this._adaptor.ready();
    const rows = db.select().from(sshKeyEntity).orderBy(asc(sshKeyEntity.label)).all();
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

// --- Known host --------------------------------------------------------------------------

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

  private readonly _adaptor: IDatabaseMobileAdaptorService;

  constructor(
    @Inject(IDatabaseMobileAdaptorService) adaptor: IDatabaseMobileAdaptorService
  ) {
    super();
    this._adaptor = adaptor;
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
    const db = await this._adaptor.ready();
    const rows = db.select().from(knownHostEntity).all();
    return rows.map((r) => this._toSyncRow(r));
  }

  async getById(id: string): Promise<ISyncEntityRow | null> {
    const db = await this._adaptor.ready();
    const row = db.select().from(knownHostEntity).where(eq(knownHostEntity.id, id)).get();
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
    const db = await this._adaptor.ready();
    db.delete(knownHostEntity).where(eq(knownHostEntity.id, id)).run();
    await this._refresh();
  }

  async upsertKnownHost(input: { host: string; port: number; keyType: string; fingerprint: string; publicKey?: string | null }): Promise<string> {
    // Deterministic id from the (host, port, keyType) natural key — must match the desktop
    // scheme (makeKnownHostId: sha256 hex prefix) so both clients' sync streams converge on
    // a single trust row instead of diverging into duplicates.
    const digest = bytesToHex(sha256(new TextEncoder().encode(`${input.host}|${input.port}|${input.keyType}`)));
    const id = `kh_${digest.slice(0, 24)}`;
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

  private _toSyncRow(row: IKnownHostEntity): ISyncEntityRow {
    return {
      id: row.id,
      host: row.host,
      port: row.port,
      keyType: row.keyType,
      fingerprint: row.fingerprint,
      publicKey: row.publicKey,
      lastSeenAt: row.lastSeenAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } as unknown as ISyncEntityRow;
  }

  private async _persist(v: { id: string; host: string; port: number; keyType: string; fingerprint: string; publicKey: string | null; lastSeenAt: string | null; createdAt: string; updatedAt: string }): Promise<void> {
    const db = await this._adaptor.ready();
    db.insert(knownHostEntity)
      .values({
        id: v.id,
        host: v.host,
        port: v.port,
        keyType: v.keyType,
        fingerprint: v.fingerprint,
        publicKey: v.publicKey,
        lastSeenAt: v.lastSeenAt,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      })
      .onConflictDoUpdate({
        target: knownHostEntity.id,
        set: {
          host: v.host,
          port: v.port,
          keyType: v.keyType,
          fingerprint: v.fingerprint,
          publicKey: v.publicKey,
          lastSeenAt: v.lastSeenAt,
          updatedAt: v.updatedAt,
        },
      })
      .run();
  }

  private async _refresh(): Promise<void> {
    const db = await this._adaptor.ready();
    const rows = db.select().from(knownHostEntity).orderBy(asc(knownHostEntity.host)).all();
    this._knownHosts$.next(rows.map((r) => ({
      id: r.id,
      host: r.host,
      port: r.port,
      keyType: r.keyType,
      fingerprint: r.fingerprint,
      publicKey: r.publicKey,
      lastSeenAt: r.lastSeenAt,
    })));
  }
}
