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
import type { SyncResourceId } from '../common/constants';
import type { ISyncFieldMeta } from '../models/mutation';
import type { BackupImportMode } from './backup.service';
import { createIdentifier } from '@termlnk/core';

// Repository contracts the sync engine (@termlnk/sync-engine) depends on. They live in the
// contract layer so the engine never imports a concrete persistence package: the desktop
// binds Drizzle implementations (@termlnk/database), React Native binds expo-sqlite ones.
//
// The engine treats domain rows as opaque, encryptable JSON blobs — it only ever reads
// `.id` (and skill's `.source`) and round-trips the rest through JSON.stringify/encrypt.
// The row interfaces here capture exactly that minimal surface; concrete implementations
// satisfy them structurally (their richer entity types are assignable). Repository methods
// use method syntax deliberately so TypeScript checks parameters bivariantly, letting a
// concrete `syncUpsertRow(entity: IHostEntity)` satisfy `syncUpsertRow(entity: ISyncEntityRow)`.

// --- Shared row + change-event shapes --------------------------------------------------

// Opaque persisted row. The engine never inspects fields beyond `id`.
export interface ISyncEntityRow {
  readonly id: string;
}

// Write side of an opaque row. The engine only ever builds one by decrypting + spreading a
// server payload, so the index signature lets a concrete repository's richer insert shape
// stay bivariantly compatible with the contract.
export interface ISyncWritableRow {
  readonly id?: string;
  readonly [key: string]: unknown;
}

// Skill rows additionally gate on `source` — built-in skills never enter the sync stream.
export interface ISyncSkillRow extends ISyncEntityRow {
  readonly source: string;
}

// Row-level repositories emit this on every local mutation.
export interface ISyncRowChangeEvent {
  readonly type: 'add' | 'update' | 'delete';
  readonly id: string;
}

// Host adds `move` (pid/tree/sort change) which the synchroniser folds into `update`.
export interface ISyncHostChangeEvent {
  readonly type: 'add' | 'update' | 'delete' | 'move';
  readonly id: string;
}

// Provider repository spans three tables under one resource id; `type` selects the table.
export interface IProviderChangeEvent {
  readonly type: 'provider' | 'model-config' | 'custom-model';
  readonly action: 'set' | 'delete';
  readonly id: string;
}

// Config is field-level: `subKey` is present for per-field events, absent for whole-key.
export interface IConfigChangeEvent {
  readonly type: 'set' | 'delete';
  readonly key: string;
  readonly subKey?: string;
}

export interface IConfigEntry {
  readonly key: string;
  readonly value: unknown;
}

// --- Sync infrastructure tables (engine-owned) -----------------------------------------

export interface ISyncOutboxRow {
  readonly id: string;
  readonly clientMutId: number;
  readonly resource: SyncResourceId;
  readonly op: 'upsert' | 'delete';
  readonly entityId: string;
  // Decoded bytes (never Buffer) so the contract stays platform-agnostic; the persistence
  // layer owns any Buffer<->Uint8Array conversion at the storage boundary.
  readonly payload: Uint8Array | null;
  readonly baseVersion: number | null;
  readonly createdAt: number;
  readonly retryCount: number;
}

export interface ISyncOutboxInsert {
  readonly id?: string;
  readonly clientMutId: number;
  readonly resource: SyncResourceId;
  readonly op: 'upsert' | 'delete';
  readonly entityId: string;
  readonly payload: Uint8Array | null;
  readonly baseVersion: number | null;
  readonly createdAt: number;
  readonly retryCount?: number;
}

export interface ISyncOutboxRepository {
  insert(record: ISyncOutboxInsert): Promise<ISyncOutboxRow>;
  selectFifo(limit?: number): Promise<ISyncOutboxRow[]>;
  deleteByClientMutIds(clientMutIds: number[]): Promise<void>;
  incrementRetry(clientMutIds: number[]): Promise<{ clientMutId: number; retryCount: number }[]>;
  updateBaseVersion(clientMutId: number, baseVersion: number): Promise<void>;
  countAll(): Promise<number>;
  countByResource(resource: SyncResourceId): Promise<number>;
  deleteByResource(resource: SyncResourceId): Promise<void>;
  deleteByResourceAndEntityId(resource: SyncResourceId, entityId: string): Promise<number>;
  deleteByResourceAndEntityIdPrefixes(resource: SyncResourceId, prefixes: readonly string[]): Promise<number>;
  maxClientMutId(): Promise<number>;
}
export const ISyncOutboxRepository = createIdentifier<ISyncOutboxRepository>('sync.outbox-repository');

export interface ISyncRowMeta {
  readonly resource: SyncResourceId;
  readonly entityId: string;
  readonly version: number;
  readonly updatedAt: number;
}

export interface ISyncRowMetaRepository {
  get(resource: SyncResourceId, entityId: string): Promise<ISyncRowMeta | null>;
  getAll(resource: SyncResourceId): Promise<ISyncRowMeta[]>;
  upsert(meta: ISyncRowMeta): Promise<void>;
  delete(resource: SyncResourceId, entityId: string): Promise<void>;
  deleteResource(resource: SyncResourceId): Promise<void>;
}
export const ISyncRowMetaRepository = createIdentifier<ISyncRowMetaRepository>('sync.row-meta-repository');

export interface ISyncFieldMetaRepository {
  get(resource: SyncResourceId, entityId: string, field: string): Promise<ISyncFieldMeta | null>;
  getByEntity(resource: SyncResourceId, entityId: string): Promise<ISyncFieldMeta[]>;
  getAllByResource(resource: SyncResourceId): Promise<ISyncFieldMeta[]>;
  upsert(meta: ISyncFieldMeta): Promise<void>;
  delete(resource: SyncResourceId, entityId: string, field: string): Promise<void>;
  deleteResource(resource: SyncResourceId): Promise<void>;
}
export const ISyncFieldMetaRepository = createIdentifier<ISyncFieldMetaRepository>('sync.field-meta-repository');

export interface ISyncCursorRow {
  readonly resource: SyncResourceId;
  readonly cursor: string;
  readonly lastPulledAt: number;
}

export interface ISyncCursorRepository {
  get(resource: SyncResourceId): Promise<ISyncCursorRow | null>;
  upsert(cursor: ISyncCursorRow): Promise<void>;
  delete(resource: SyncResourceId): Promise<void>;
}
export const ISyncCursorRepository = createIdentifier<ISyncCursorRepository>('sync.cursor-repository');

// --- Domain repositories (one per synced resource) -------------------------------------

export interface ISyncConfigRepository {
  readonly changed$: Observable<IConfigChangeEvent>;
  get<T = unknown>(key: string): Promise<T | null>;
  getAll(): Promise<IConfigEntry[]>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  getField<T = unknown>(key: string, field: string): Promise<T | null>;
  setField(key: string, field: string, value: unknown): Promise<void>;
  deleteField(key: string, field: string): Promise<void>;
}
export const ISyncConfigRepository = createIdentifier<ISyncConfigRepository>('sync.config-repository');

export interface ISyncHostTreeNode {
  readonly id: string;
  readonly children?: readonly ISyncHostTreeNode[];
}

export interface IHostSyncRepository {
  readonly changed$: Observable<ISyncHostChangeEvent>;
  getTree(): Promise<ISyncHostTreeNode[]>;
  getInfoById(id: string): Promise<ISyncEntityRow | null | undefined>;
  syncUpsertRow(entity: ISyncEntityRow): Promise<void>;
  delete(id: string): Promise<void>;
}
export const IHostSyncRepository = createIdentifier<IHostSyncRepository>('sync.host-repository');

export interface IIdentitySyncRepository {
  readonly changed$: Observable<ISyncRowChangeEvent>;
  getList(): Promise<ISyncEntityRow[]>;
  getById(id: string): Promise<ISyncEntityRow | null | undefined>;
  syncUpsertRow(entity: ISyncEntityRow): Promise<void>;
  delete(id: string): Promise<void>;
}
export const IIdentitySyncRepository = createIdentifier<IIdentitySyncRepository>('sync.identity-repository');

export interface ISshKeySyncRepository {
  readonly changed$: Observable<ISyncRowChangeEvent>;
  getList(): Promise<ISyncEntityRow[]>;
  getById(id: string): Promise<ISyncEntityRow | null | undefined>;
  syncUpsertRow(entity: ISyncEntityRow): Promise<void>;
  syncDeleteRow(id: string): Promise<void>;
}
export const ISshKeySyncRepository = createIdentifier<ISshKeySyncRepository>('sync.ssh-key-repository');

export interface IKnownHostSyncRepository {
  readonly changed$: Observable<ISyncRowChangeEvent>;
  getList(): Promise<ISyncEntityRow[]>;
  getById(id: string): Promise<ISyncEntityRow | null | undefined>;
  syncUpsertRow(entity: ISyncEntityRow): Promise<void>;
  delete(id: string): Promise<void>;
}
export const IKnownHostSyncRepository = createIdentifier<IKnownHostSyncRepository>('sync.known-host-repository');

export interface IMcpServerSyncRepository {
  readonly changed$: Observable<ISyncRowChangeEvent>;
  getAll(): Promise<ISyncEntityRow[]>;
  getById(id: string): Promise<ISyncEntityRow | null | undefined>;
  create(record: ISyncWritableRow): Promise<string>;
  update(id: string, updates: ISyncWritableRow): Promise<void>;
  delete(id: string): Promise<void>;
}
export const IMcpServerSyncRepository = createIdentifier<IMcpServerSyncRepository>('sync.mcp-repository');

export interface ISkillSyncRepository {
  readonly changed$: Observable<ISyncRowChangeEvent>;
  getAll(): Promise<ISyncSkillRow[]>;
  getById(id: string): Promise<ISyncSkillRow | null | undefined>;
  upsert(record: ISyncEntityRow): Promise<string>;
  delete(id: string): Promise<void>;
}
export const ISkillSyncRepository = createIdentifier<ISkillSyncRepository>('sync.skill-repository');

export interface IProviderSyncRepository {
  readonly changed$: Observable<IProviderChangeEvent>;
  getProviders(): Promise<ISyncEntityRow[]>;
  getProviderById(id: string): Promise<ISyncEntityRow | null | undefined>;
  getAllModelConfigs(): Promise<ISyncEntityRow[]>;
  getAllCustomModels(): Promise<ISyncEntityRow[]>;
  upsertProvider(row: ISyncEntityRow): Promise<void>;
  upsertModelConfig(row: ISyncEntityRow): Promise<void>;
  upsertCustomModel(row: ISyncEntityRow): Promise<void>;
  deleteProvider(id: string): Promise<void>;
  deleteModelConfig(id: string): Promise<void>;
  deleteCustomModel(id: string): Promise<void>;
}
export const IProviderSyncRepository = createIdentifier<IProviderSyncRepository>('sync.provider-repository');

// --- Backup ----------------------------------------------------------------------------

// The engine serializes the whole snapshot opaquely and only reads `exportedAt` plus
// per-resource counts; resource arrays stay `unknown[]` so the contract need not mirror
// every entity shape.
export interface IBackupSnapshot {
  readonly version: 1;
  readonly exportedAt: number;
  readonly resources: {
    readonly host: readonly unknown[];
    readonly config: readonly unknown[];
    readonly ai_provider: readonly unknown[];
    readonly ai_provider_model: readonly unknown[];
    readonly ai_custom_model: readonly unknown[];
    readonly mcp_server: readonly unknown[];
    readonly skill: readonly unknown[];
  };
}

export interface IBackupRepository {
  exportSnapshot(): Promise<IBackupSnapshot>;
  importSnapshot(snapshot: IBackupSnapshot, mode: BackupImportMode): Promise<void>;
}
export const IBackupRepository = createIdentifier<IBackupRepository>('sync.backup-repository');
