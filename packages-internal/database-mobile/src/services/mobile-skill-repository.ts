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

import type { ISkillSyncRepository, ISyncEntityRow, ISyncRowChangeEvent, ISyncSkillRow } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import { Disposable, Inject } from '@termlnk/core';
import { eq } from 'drizzle-orm';
import { Subject } from 'rxjs';
import { skillEntity } from '../entities/skill';
import { IDatabaseMobileAdaptorService } from './expo-sqlite-adaptor.service';

// Mobile mirror of desktop's SkillRepository sync surface (ISkillSyncRepository).
// No column carries secrets, so no cipher is involved. Skill files themselves never
// sync — the shared SkillSynchroniser only moves the metadata row, and built-in rows
// are filtered out by the synchroniser before they reach this repository.
export class MobileSkillRepository extends Disposable implements ISkillSyncRepository {
  private readonly _changed$ = new Subject<ISyncRowChangeEvent>();
  readonly changed$: Observable<ISyncRowChangeEvent> = this._changed$.asObservable();

  private readonly _adaptor: IDatabaseMobileAdaptorService;

  constructor(
    @Inject(IDatabaseMobileAdaptorService) adaptor: IDatabaseMobileAdaptorService
  ) {
    super();
    this._adaptor = adaptor;
  }

  override dispose(): void {
    super.dispose();
    this._changed$.complete();
  }

  async getAll(): Promise<ISyncSkillRow[]> {
    const db = await this._adaptor.ready();
    return db.select().from(skillEntity).all() as unknown as ISyncSkillRow[];
  }

  async getById(id: string): Promise<ISyncSkillRow | null> {
    const db = await this._adaptor.ready();
    const row = db.select().from(skillEntity).where(eq(skillEntity.id, id)).get();
    return (row as unknown as ISyncSkillRow) ?? null;
  }

  async upsert(record: ISyncEntityRow): Promise<string> {
    const db = await this._adaptor.ready();
    const row = record as unknown as Record<string, unknown>;
    const values = {
      name: (row.name as string) ?? '',
      path: (row.path as string) ?? '',
      source: (row.source as string) ?? 'user',
      registryId: (row.registryId as string | null) ?? null,
      version: (row.version as string | null) ?? null,
      enabled: (row.enabled as boolean) ?? true,
      sortOrder: (row.sortOrder as number) ?? 0,
      checksum: (row.checksum as string | null) ?? null,
    };
    db.insert(skillEntity)
      .values({
        id: record.id,
        ...values,
        // Preserve payload timestamps on first materialisation; defaults only fill
        // genuinely absent values.
        createdAt: typeof row.createdAt === 'string' ? row.createdAt : undefined,
        updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : undefined,
      })
      .onConflictDoUpdate({
        target: skillEntity.id,
        set: { ...values, updatedAt: new Date().toISOString() },
      })
      .run();
    this._changed$.next({ type: 'update', id: record.id });
    return record.id;
  }

  async delete(id: string): Promise<void> {
    const db = await this._adaptor.ready();
    db.delete(skillEntity).where(eq(skillEntity.id, id)).run();
    this._changed$.next({ type: 'delete', id });
  }
}
