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

export class ProviderRepository extends Disposable {
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

  /** 解密 provider 实体的 apiKey 字段；返回新对象 */
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
    // 入库前透明加密 apiKey；明文永不入库
    const encryptedApiKey = encryptIfNeeded(data.apiKey, this._cipher);
    const payload: IAIProviderEntityInsert = {
      ...data,
      apiKey: encryptedApiKey,
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
          headers: data.headers,
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
    await this._db
      .insert(aiProviderModelEntity)
      .values(data)
      .onConflictDoUpdate({
        target: aiProviderModelEntity.id,
        set: {
          enabled: data.enabled,
          overrides: data.overrides,
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
    await this._db
      .insert(aiCustomModelEntity)
      .values(data)
      .onConflictDoUpdate({
        target: aiCustomModelEntity.id,
        set: {
          name: data.name,
          api: data.api,
          baseUrl: data.baseUrl,
          reasoning: data.reasoning,
          inputModes: data.inputModes,
          cost: data.cost,
          contextWindow: data.contextWindow,
          maxTokens: data.maxTokens,
          headers: data.headers,
          compat: data.compat,
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
