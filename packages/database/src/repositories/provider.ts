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

import type { IProviderSyncRepository } from '@termlnk/sync';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../entities';
import type { IAICustomModelEntityInsert, IAIProviderEntity, IAIProviderEntityInsert, IAIProviderModelEntityInsert } from '../entities/provider';
import { Disposable } from '@termlnk/core';
import { eq } from 'drizzle-orm';
import { Subject } from 'rxjs';
import { aiCustomModelEntity, aiProviderEntity, aiProviderModelEntity } from '../entities/provider';
import { IDBAdaptorService } from '../services/db-adaptor.service';
import { ISecretCipherService } from '../services/secret-cipher.service';
import { decryptIfNeeded, encryptIfNeeded } from '../services/secret-cipher/credential-masker';

export interface IProviderChangeEvent {
  type: 'provider' | 'model-config' | 'custom-model';
  action: 'set' | 'delete';
  id: string;
}

// Sync payloads from older mobile builds carried JSON columns as raw strings
// (mobile used plain text columns); writing those into a json-mode column would
// stringify again and corrupt the value. Decode strings back before persisting.
function decodeJsonColumn(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value ?? null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export class ProviderRepository extends Disposable implements IProviderSyncRepository {
  private readonly _changed$ = new Subject<IProviderChangeEvent>();
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

  private _decryptProvider(row: IAIProviderEntity): IAIProviderEntity {
    return {
      ...row,
      apiKey: decryptIfNeeded(row.apiKey, this._cipher),
    };
  }

  // ---------------------------------------------------------------------------
  // Provider CRUD
  // ---------------------------------------------------------------------------

  async getProviders() {
    const rows = await this._db.select().from(aiProviderEntity);
    return rows.map((row) => this._decryptProvider(row));
  }

  async getProviderById(id: string) {
    const rows = await this._db
      .select()
      .from(aiProviderEntity)
      .where(eq(aiProviderEntity.id, id))
      .limit(1);
    return rows[0] ? this._decryptProvider(rows[0]) : null;
  }

  async upsertProvider(data: IAIProviderEntityInsert) {
    const encryptedApiKey = encryptIfNeeded(data.apiKey, this._cipher);
    const headers = decodeJsonColumn(data.headers);
    const payload: IAIProviderEntityInsert = {
      ...data,
      apiKey: encryptedApiKey,
      headers,
    };
    await this._db
      .insert(aiProviderEntity)
      .values(payload)
      .onConflictDoUpdate({
        target: aiProviderEntity.id,
        set: {
          name: data.name,
          enabled: data.enabled,
          builtin: data.builtin,
          api: data.api,
          apiKey: encryptedApiKey,
          baseUrl: data.baseUrl,
          headers,
          sort: data.sort,
          updatedAt: new Date().toISOString(),
        },
      });
    this._changed$.next({ type: 'provider', action: 'set', id: data.id });
  }

  async deleteProvider(id: string) {
    // Cascade: delete associated model configs and custom models
    await this._db.delete(aiProviderModelEntity).where(eq(aiProviderModelEntity.providerId, id));
    await this._db.delete(aiCustomModelEntity).where(eq(aiCustomModelEntity.providerId, id));
    await this._db.delete(aiProviderEntity).where(eq(aiProviderEntity.id, id));
    this._changed$.next({ type: 'provider', action: 'delete', id });
  }

  // ---------------------------------------------------------------------------
  // Model Config CRUD (delta)
  // ---------------------------------------------------------------------------

  async getModelConfigs(providerId: string) {
    return this._db
      .select()
      .from(aiProviderModelEntity)
      .where(eq(aiProviderModelEntity.providerId, providerId));
  }

  async getAllModelConfigs() {
    return this._db.select().from(aiProviderModelEntity);
  }

  async upsertModelConfig(data: IAIProviderModelEntityInsert) {
    const overrides = decodeJsonColumn(data.overrides);
    await this._db
      .insert(aiProviderModelEntity)
      .values({ ...data, overrides })
      .onConflictDoUpdate({
        target: aiProviderModelEntity.id,
        set: {
          enabled: data.enabled,
          overrides,
          updatedAt: new Date().toISOString(),
        },
      });
    this._changed$.next({ type: 'model-config', action: 'set', id: data.id });
  }

  async deleteModelConfig(id: string) {
    await this._db.delete(aiProviderModelEntity).where(eq(aiProviderModelEntity.id, id));
    this._changed$.next({ type: 'model-config', action: 'delete', id });
  }

  async deleteModelConfigsByProviderId(providerId: string) {
    await this._db.delete(aiProviderModelEntity).where(eq(aiProviderModelEntity.providerId, providerId));
    this._changed$.next({ type: 'model-config', action: 'delete', id: providerId });
  }

  // ---------------------------------------------------------------------------
  // Custom Model CRUD
  // ---------------------------------------------------------------------------

  async getCustomModels(providerId: string) {
    return this._db
      .select()
      .from(aiCustomModelEntity)
      .where(eq(aiCustomModelEntity.providerId, providerId));
  }

  async getAllCustomModels() {
    return this._db.select().from(aiCustomModelEntity);
  }

  async upsertCustomModel(data: IAICustomModelEntityInsert) {
    // inputModes is NOT NULL here but nullable on older mobile schemas; fall back to
    // the column default so a null payload converges instead of failing the insert.
    const inputModes = decodeJsonColumn(data.inputModes) ?? ['text'];
    const cost = decodeJsonColumn(data.cost);
    const headers = decodeJsonColumn(data.headers);
    const compat = decodeJsonColumn(data.compat);
    await this._db
      .insert(aiCustomModelEntity)
      .values({ ...data, inputModes, cost, headers, compat })
      .onConflictDoUpdate({
        target: aiCustomModelEntity.id,
        set: {
          name: data.name,
          api: data.api,
          baseUrl: data.baseUrl,
          reasoning: data.reasoning,
          inputModes,
          cost,
          contextWindow: data.contextWindow,
          maxTokens: data.maxTokens,
          headers,
          compat,
          sort: data.sort,
          updatedAt: new Date().toISOString(),
        },
      });
    this._changed$.next({ type: 'custom-model', action: 'set', id: data.id });
  }

  async deleteCustomModel(id: string) {
    await this._db.delete(aiCustomModelEntity).where(eq(aiCustomModelEntity.id, id));
    this._changed$.next({ type: 'custom-model', action: 'delete', id });
  }

  async deleteCustomModelsByProviderId(providerId: string) {
    await this._db.delete(aiCustomModelEntity).where(eq(aiCustomModelEntity.providerId, providerId));
    this._changed$.next({ type: 'custom-model', action: 'delete', id: providerId });
  }
}
