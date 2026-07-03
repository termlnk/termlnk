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

import type { ILogService } from '@termlnk/core';
import type { IProviderChangeEvent, IProviderSyncRepository, ISyncEntityRow } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import { base64ToBytes, bytesToBase64 } from '@termlnk/auth';
import { Disposable, ILogService as ILogServiceId, Inject } from '@termlnk/core';
import { eq } from 'drizzle-orm';
import { Subject } from 'rxjs';
import { aiCustomModelEntity } from '../entities/ai-custom-model';
import { aiProviderEntity } from '../entities/ai-provider';
import { aiProviderModelEntity } from '../entities/ai-provider-model';
import { IDatabaseMobileAdaptorService } from './expo-sqlite-adaptor.service';
import { IMobileSecretCipherService } from './mobile-secret-cipher.service';

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

// JSON columns use drizzle json mode (stringify on write, parse on read) to stay
// symmetric with the desktop schema. Sync payloads normally carry these fields
// decoded, but payloads produced by older mobile builds — and local callers that
// still pre-stringify — hand us raw JSON strings; decode them so the json-mode
// column does not double-encode.
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

export class MobileProviderRepository extends Disposable implements IProviderSyncRepository {
  private readonly _changed$ = new Subject<IProviderChangeEvent>();
  readonly changed$: Observable<IProviderChangeEvent> = this._changed$.asObservable();

  private readonly _adaptor: IDatabaseMobileAdaptorService;
  private readonly _cipher: IMobileSecretCipherService;
  private readonly _logService: ILogService;

  constructor(
    @Inject(IDatabaseMobileAdaptorService) adaptor: IDatabaseMobileAdaptorService,
    @Inject(IMobileSecretCipherService) cipher: IMobileSecretCipherService,
    @Inject(ILogServiceId) logService: ILogService
  ) {
    super();
    this._adaptor = adaptor;
    this._cipher = cipher;
    this._logService = logService;
  }

  override dispose(): void {
    super.dispose();
    this._changed$.complete();
  }

  async getProviders(): Promise<ISyncEntityRow[]> {
    const db = await this._adaptor.ready();
    const rows = db.select().from(aiProviderEntity).all();
    const decrypted: ISyncEntityRow[] = [];
    for (const row of rows) {
      decrypted.push({
        ...row,
        apiKey: await this._tryDecryptString(row.id, 'apiKey', row.apiKey),
      } as unknown as ISyncEntityRow);
    }
    return decrypted;
  }

  async getProviderById(id: string): Promise<ISyncEntityRow | null> {
    const db = await this._adaptor.ready();
    const row = db.select().from(aiProviderEntity).where(eq(aiProviderEntity.id, id)).get();
    if (!row) {
      return null;
    }
    return {
      ...row,
      apiKey: await this._tryDecryptString(row.id, 'apiKey', row.apiKey),
    } as unknown as ISyncEntityRow;
  }

  async upsertProvider(data: ISyncEntityRow): Promise<void> {
    const db = await this._adaptor.ready();
    const row = data as unknown as Record<string, unknown>;
    const encryptedApiKey = await this._encryptStringIfNeeded(row.apiKey as string | null | undefined);
    db.insert(aiProviderEntity)
      .values({
        id: row.id as string,
        name: (row.name as string) ?? '',
        enabled: row.enabled as boolean ?? false,
        builtin: row.builtin as boolean ?? false,
        api: row.api as string | null ?? null,
        apiKey: encryptedApiKey,
        baseUrl: row.baseUrl as string | null ?? null,
        headers: decodeJsonColumn(row.headers),
        sort: (row.sort as number) ?? 0,
      })
      .onConflictDoUpdate({
        target: aiProviderEntity.id,
        set: {
          name: (row.name as string) ?? '',
          enabled: row.enabled as boolean ?? false,
          builtin: row.builtin as boolean ?? false,
          api: row.api as string | null ?? null,
          apiKey: encryptedApiKey,
          baseUrl: row.baseUrl as string | null ?? null,
          headers: decodeJsonColumn(row.headers),
          sort: (row.sort as number) ?? 0,
          updatedAt: new Date().toISOString(),
        },
      })
      .run();
    this._changed$.next({ type: 'provider', action: 'set', id: row.id as string });
  }

  async deleteProvider(id: string): Promise<void> {
    const db = await this._adaptor.ready();
    db.delete(aiProviderModelEntity).where(eq(aiProviderModelEntity.providerId, id)).run();
    db.delete(aiCustomModelEntity).where(eq(aiCustomModelEntity.providerId, id)).run();
    db.delete(aiProviderEntity).where(eq(aiProviderEntity.id, id)).run();
    this._changed$.next({ type: 'provider', action: 'delete', id });
  }

  async getAllModelConfigs(): Promise<ISyncEntityRow[]> {
    const db = await this._adaptor.ready();
    const rows = db.select().from(aiProviderModelEntity).all();
    return rows as unknown as ISyncEntityRow[];
  }

  async upsertModelConfig(data: ISyncEntityRow): Promise<void> {
    const db = await this._adaptor.ready();
    const row = data as unknown as Record<string, unknown>;
    db.insert(aiProviderModelEntity)
      .values({
        id: row.id as string,
        providerId: row.providerId as string,
        modelId: row.modelId as string,
        enabled: row.enabled as boolean ?? false,
        overrides: decodeJsonColumn(row.overrides),
      })
      .onConflictDoUpdate({
        target: aiProviderModelEntity.id,
        set: {
          enabled: row.enabled as boolean ?? false,
          overrides: decodeJsonColumn(row.overrides),
          updatedAt: new Date().toISOString(),
        },
      })
      .run();
    this._changed$.next({ type: 'model-config', action: 'set', id: row.id as string });
  }

  async deleteModelConfig(id: string): Promise<void> {
    const db = await this._adaptor.ready();
    db.delete(aiProviderModelEntity).where(eq(aiProviderModelEntity.id, id)).run();
    this._changed$.next({ type: 'model-config', action: 'delete', id });
  }

  async getAllCustomModels(): Promise<ISyncEntityRow[]> {
    const db = await this._adaptor.ready();
    const rows = db.select().from(aiCustomModelEntity).all();
    return rows as unknown as ISyncEntityRow[];
  }

  async upsertCustomModel(data: ISyncEntityRow): Promise<void> {
    const db = await this._adaptor.ready();
    const row = data as unknown as Record<string, unknown>;
    db.insert(aiCustomModelEntity)
      .values({
        id: row.id as string,
        providerId: row.providerId as string,
        modelId: row.modelId as string,
        name: (row.name as string) ?? '',
        api: row.api as string | null ?? null,
        baseUrl: row.baseUrl as string | null ?? null,
        reasoning: row.reasoning as boolean ?? false,
        inputModes: decodeJsonColumn(row.inputModes) ?? ['text'],
        cost: decodeJsonColumn(row.cost),
        contextWindow: (row.contextWindow as number) ?? 128000,
        maxTokens: (row.maxTokens as number) ?? 16384,
        headers: decodeJsonColumn(row.headers),
        compat: decodeJsonColumn(row.compat),
        sort: (row.sort as number) ?? 0,
      })
      .onConflictDoUpdate({
        target: aiCustomModelEntity.id,
        set: {
          name: (row.name as string) ?? '',
          api: row.api as string | null ?? null,
          baseUrl: row.baseUrl as string | null ?? null,
          reasoning: row.reasoning as boolean ?? false,
          inputModes: decodeJsonColumn(row.inputModes) ?? ['text'],
          cost: decodeJsonColumn(row.cost),
          contextWindow: (row.contextWindow as number) ?? 128000,
          maxTokens: (row.maxTokens as number) ?? 16384,
          headers: decodeJsonColumn(row.headers),
          compat: decodeJsonColumn(row.compat),
          sort: (row.sort as number) ?? 0,
          updatedAt: new Date().toISOString(),
        },
      })
      .run();
    this._changed$.next({ type: 'custom-model', action: 'set', id: row.id as string });
  }

  async deleteCustomModel(id: string): Promise<void> {
    const db = await this._adaptor.ready();
    db.delete(aiCustomModelEntity).where(eq(aiCustomModelEntity.id, id)).run();
    this._changed$.next({ type: 'custom-model', action: 'delete', id });
  }

  private async _encryptStringIfNeeded(value: string | null | undefined): Promise<string | null> {
    if (!value) {
      return null;
    }
    if (value.startsWith('tmlocal1:')) {
      return value;
    }
    try {
      const plaintext = TEXT_ENCODER.encode(value);
      const frame = await this._cipher.encrypt(plaintext);
      return bytesToBase64(frame);
    } catch (err) {
      this._logService.warn('[MobileProviderRepository] encrypt failed:', err);
      return null;
    }
  }

  private async _tryDecryptString(id: string, label: string, b64: string | null): Promise<string | null> {
    if (!b64) {
      return null;
    }
    try {
      const frame = base64ToBytes(b64);
      const plaintext = await this._cipher.decrypt(frame);
      return TEXT_DECODER.decode(plaintext);
    } catch (err) {
      this._logService.warn(`[MobileProviderRepository] failed to decrypt ${label} for ${id}:`, err);
      return null;
    }
  }
}
