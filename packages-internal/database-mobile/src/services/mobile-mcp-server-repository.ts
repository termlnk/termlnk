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
import type { IMcpServerSyncRepository, ISyncEntityRow, ISyncRowChangeEvent, ISyncWritableRow } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import { base64ToBytes, bytesToBase64 } from '@termlnk/auth';
import { Disposable, ILogService as ILogServiceId, Inject } from '@termlnk/core';
import { eq } from 'drizzle-orm';
import { Subject } from 'rxjs';
import { generateId } from '../entities/base';
import { mcpServerEntity } from '../entities/mcp-server';
import { IDatabaseMobileAdaptorService } from './expo-sqlite-adaptor.service';
import { IMobileSecretCipherService } from './mobile-secret-cipher.service';

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
const FRAME_PREFIX_BYTES = TEXT_ENCODER.encode('tmlocal1:');

// JSON columns use drizzle json mode; sync payloads normally carry decoded values, but
// payloads produced by older builds — and callers that pre-stringify — hand us raw JSON
// strings; decode them so the json-mode column does not double-encode.
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

// Mobile mirror of desktop's McpServerRepository sync surface (IMcpServerSyncRepository).
// Same at-rest secret semantics as desktop: only env (stdio) / headers (http) VALUES in
// `config` are encrypted — keys and every other column stay plaintext. Reads return
// decrypted rows so the sync payload the engine stringifies matches desktop field-for-
// field. mcp_oauth_token has no mobile counterpart: tokens are device-bound and excluded
// from sync on desktop too.
export class MobileMcpServerRepository extends Disposable implements IMcpServerSyncRepository {
  private readonly _changed$ = new Subject<ISyncRowChangeEvent>();
  readonly changed$: Observable<ISyncRowChangeEvent> = this._changed$.asObservable();

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

  async getAll(): Promise<ISyncEntityRow[]> {
    const db = await this._adaptor.ready();
    const rows = db.select().from(mcpServerEntity).all();
    const out: ISyncEntityRow[] = [];
    for (const row of rows) {
      out.push({
        ...row,
        config: await this._decryptConfigSecrets(decodeJsonColumn(row.config)),
        capabilities: decodeJsonColumn(row.capabilities),
      } as unknown as ISyncEntityRow);
    }
    return out;
  }

  async getById(id: string): Promise<ISyncEntityRow | null> {
    const db = await this._adaptor.ready();
    const row = db.select().from(mcpServerEntity).where(eq(mcpServerEntity.id, id)).get();
    if (!row) {
      return null;
    }
    return {
      ...row,
      config: await this._decryptConfigSecrets(decodeJsonColumn(row.config)),
      capabilities: decodeJsonColumn(row.capabilities),
    } as unknown as ISyncEntityRow;
  }

  async create(record: ISyncWritableRow): Promise<string> {
    const db = await this._adaptor.ready();
    const row = record as Record<string, unknown>;
    const id = (row.id as string) || generateId();
    db.insert(mcpServerEntity)
      .values({
        id,
        ...await this._toColumnValues(row),
        // Preserve payload timestamps on first materialisation so the row mirrors its
        // origin device; the column defaults only fill genuinely absent values.
        createdAt: typeof row.createdAt === 'string' ? row.createdAt : undefined,
        updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : undefined,
      })
      .run();
    this._changed$.next({ type: 'add', id });
    return id;
  }

  async update(id: string, updates: ISyncWritableRow): Promise<void> {
    // The only mobile writer is the sync patch path, which always supplies the full row
    // (desktop row minus id) — so a full-column set matches desktop's partial-spread
    // update exactly. updatedAt is stamped locally, mirroring desktop.
    const db = await this._adaptor.ready();
    const row = updates as Record<string, unknown>;
    db.update(mcpServerEntity)
      .set({
        ...await this._toColumnValues(row),
        // Desktop's partial-spread update carries the payload createdAt through; mirror it.
        ...(typeof row.createdAt === 'string' ? { createdAt: row.createdAt } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(mcpServerEntity.id, id))
      .run();
    this._changed$.next({ type: 'update', id });
  }

  async delete(id: string): Promise<void> {
    const db = await this._adaptor.ready();
    db.delete(mcpServerEntity).where(eq(mcpServerEntity.id, id)).run();
    this._changed$.next({ type: 'delete', id });
  }

  // Maps an opaque sync row onto typed columns (defaults match the desktop schema) and
  // re-encrypts config secrets with the local device cipher.
  private async _toColumnValues(row: Record<string, unknown>) {
    return {
      registryId: (row.registryId as string | null) ?? null,
      name: (row.name as string) ?? '',
      description: (row.description as string | null) ?? null,
      transport: (row.transport as string) ?? 'stdio',
      config: await this._encryptConfigSecrets(decodeJsonColumn(row.config)),
      capabilities: decodeJsonColumn(row.capabilities),
      toolCount: (row.toolCount as number) ?? 0,
      resourceCount: (row.resourceCount as number) ?? 0,
      enabled: (row.enabled as boolean) ?? true,
      status: (row.status as string) ?? 'disconnected',
      lastError: (row.lastError as string | null) ?? null,
    };
  }

  // --- Config secret handling (mirrors desktop's encryptMcpConfig/decryptMcpConfig) ------

  private async _encryptConfigSecrets(config: unknown): Promise<unknown> {
    return this._mapConfigSecrets(config, (value) => this._encryptValue(value));
  }

  private async _decryptConfigSecrets(config: unknown): Promise<unknown> {
    return this._mapConfigSecrets(config, (value) => this._decryptValue(value));
  }

  private async _mapConfigSecrets(config: unknown, fn: (value: string) => Promise<string>): Promise<unknown> {
    if (!config || typeof config !== 'object') {
      return config ?? null;
    }
    const cfg = config as Record<string, unknown>;
    const secretField = cfg.type === 'stdio' ? 'env' : cfg.type === 'http' ? 'headers' : null;
    if (!secretField) {
      return config;
    }
    const secrets = cfg[secretField];
    if (!secrets || typeof secrets !== 'object') {
      return config;
    }
    const mapped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(secrets as Record<string, unknown>)) {
      mapped[key] = typeof value === 'string' ? await fn(value) : value;
    }
    return { ...cfg, [secretField]: mapped };
  }

  private async _encryptValue(value: string): Promise<string> {
    if (value === '' || this._isEncrypted(value)) {
      return value;
    }
    try {
      const frame = await this._cipher.encrypt(TEXT_ENCODER.encode(value));
      return bytesToBase64(frame);
    } catch (err) {
      this._logService.warn('[MobileMcpServerRepository] encrypt failed:', err);
      return value;
    }
  }

  private async _decryptValue(value: string): Promise<string> {
    // Non-encrypted values pass through unchanged, matching desktop's decryptIfNeeded.
    if (value === '' || !this._isEncrypted(value)) {
      return value;
    }
    try {
      const plaintext = await this._cipher.decrypt(base64ToBytes(value));
      return TEXT_DECODER.decode(plaintext);
    } catch (err) {
      this._logService.warn('[MobileMcpServerRepository] decrypt failed:', err);
      return value;
    }
  }

  private _isEncrypted(value: string): boolean {
    let bytes: Uint8Array;
    try {
      bytes = base64ToBytes(value);
    } catch {
      return false;
    }
    if (bytes.length < FRAME_PREFIX_BYTES.length) {
      return false;
    }
    for (let i = 0; i < FRAME_PREFIX_BYTES.length; i++) {
      if (bytes[i] !== FRAME_PREFIX_BYTES[i]) {
        return false;
      }
    }
    return true;
  }
}
