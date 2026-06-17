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

import type { IPortForwardingRuleSyncRepository, ISyncEntityRow, ISyncRowChangeEvent } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import type { IPortForwardingRuleEntity } from '../entities/port-forwarding-rule';
import { createIdentifier, Disposable, ILogService, Inject } from '@termlnk/core';
import { asc, eq } from 'drizzle-orm';
import { BehaviorSubject, Subject } from 'rxjs';
import { generateId } from '../entities/base';
import { portForwardingRuleEntity } from '../entities/port-forwarding-rule';
import { IDatabaseMobileAdaptorService } from './expo-sqlite-adaptor.service';

export interface IMobilePortForwardingRuleRepository extends IPortForwardingRuleSyncRepository {
  readonly rules$: Observable<readonly IPortForwardingRuleEntity[]>;
  ready(): Promise<void>;
  getById(id: string): Promise<IPortForwardingRuleEntity | null>;
  getByHostId(hostId: string): Promise<IPortForwardingRuleEntity[]>;
  saveRule(entity: Omit<IPortForwardingRuleEntity, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }, opts?: { isNew?: boolean }): Promise<IPortForwardingRuleEntity>;
  removeRule(id: string): Promise<void>;
  upsertFromSync(entity: IPortForwardingRuleEntity): Promise<void>;
  deleteFromSync(id: string): Promise<void>;
  clearFromSync(): Promise<void>;
}

export const IMobilePortForwardingRuleRepository = createIdentifier<IMobilePortForwardingRuleRepository>(
  'mobile.port-forwarding-rule-repository.service'
);

export class MobilePortForwardingRuleRepository extends Disposable implements IMobilePortForwardingRuleRepository {
  private readonly _rules$ = new BehaviorSubject<readonly IPortForwardingRuleEntity[]>([]);
  readonly rules$: Observable<readonly IPortForwardingRuleEntity[]> = this._rules$.asObservable();

  private readonly _changed$ = new Subject<ISyncRowChangeEvent>();
  readonly changed$: Observable<ISyncRowChangeEvent> = this._changed$.asObservable();

  private _readyPromise: Promise<void> | null = null;

  private readonly _adaptor: IDatabaseMobileAdaptorService;
  private readonly _logService: ILogService;

  constructor(
    @Inject(IDatabaseMobileAdaptorService) adaptor: IDatabaseMobileAdaptorService,
    @Inject(ILogService) logService: ILogService
  ) {
    super();
    this._adaptor = adaptor;
    this._logService = logService;
  }

  override dispose(): void {
    super.dispose();
    this._rules$.complete();
    this._changed$.complete();
  }

  ready(): Promise<void> {
    if (!this._readyPromise) {
      this._readyPromise = this._refreshRules();
    }
    return this._readyPromise;
  }

  async getById(id: string): Promise<IPortForwardingRuleEntity | null> {
    const db = await this._adaptor.ready();
    const row = db.select().from(portForwardingRuleEntity).where(eq(portForwardingRuleEntity.id, id)).get();
    return row ?? null;
  }

  async getByHostId(hostId: string): Promise<IPortForwardingRuleEntity[]> {
    const db = await this._adaptor.ready();
    return db.select().from(portForwardingRuleEntity)
      .where(eq(portForwardingRuleEntity.hostId, hostId))
      .orderBy(asc(portForwardingRuleEntity.sort), asc(portForwardingRuleEntity.id))
      .all();
  }

  async saveRule(
    entity: Omit<IPortForwardingRuleEntity, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    opts?: { isNew?: boolean }
  ): Promise<IPortForwardingRuleEntity> {
    const id = entity.id || generateId();
    const now = new Date().toISOString();
    const row: IPortForwardingRuleEntity = {
      ...entity,
      id,
      createdAt: now,
      updatedAt: now,
    };
    await this.upsertFromSync(row);
    this._changed$.next({ type: opts?.isNew ? 'add' : 'update', id });
    const saved = await this.getById(id);
    return saved!;
  }

  async removeRule(id: string): Promise<void> {
    await this.deleteFromSync(id);
    this._changed$.next({ type: 'delete', id });
  }

  // --- IPortForwardingRuleSyncRepository (sync engine path) ---

  async getList(): Promise<ISyncEntityRow[]> {
    const db = await this._adaptor.ready();
    return db.select().from(portForwardingRuleEntity)
      .orderBy(asc(portForwardingRuleEntity.sort), asc(portForwardingRuleEntity.id))
      .all();
  }

  async syncUpsertRow(entity: ISyncEntityRow): Promise<void> {
    const row = entity as unknown as IPortForwardingRuleEntity;
    await this.upsertFromSync(row);
  }

  async delete(id: string): Promise<void> {
    await this.deleteFromSync(id);
  }

  // --- Internal ---

  async upsertFromSync(entity: IPortForwardingRuleEntity): Promise<void> {
    const db = await this._adaptor.ready();
    const createdAt = entity.createdAt ?? new Date().toISOString();
    const updatedAt = entity.updatedAt ?? new Date().toISOString();

    db.insert(portForwardingRuleEntity)
      .values({
        id: entity.id,
        label: entity.label ?? '',
        type: entity.type,
        hostId: entity.hostId,
        bindAddress: entity.bindAddress ?? '127.0.0.1',
        bindPort: entity.bindPort,
        destinationAddress: entity.destinationAddress ?? null,
        destinationPort: entity.destinationPort ?? null,
        sort: entity.sort ?? 0,
        createdAt,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: portForwardingRuleEntity.id,
        set: {
          label: entity.label ?? '',
          type: entity.type,
          hostId: entity.hostId,
          bindAddress: entity.bindAddress ?? '127.0.0.1',
          bindPort: entity.bindPort,
          destinationAddress: entity.destinationAddress ?? null,
          destinationPort: entity.destinationPort ?? null,
          sort: entity.sort ?? 0,
          updatedAt,
        },
      })
      .run();
    await this._refreshRules();
  }

  async deleteFromSync(id: string): Promise<void> {
    const db = await this._adaptor.ready();
    db.delete(portForwardingRuleEntity).where(eq(portForwardingRuleEntity.id, id)).run();
    await this._refreshRules();
  }

  async clearFromSync(): Promise<void> {
    const db = await this._adaptor.ready();
    db.delete(portForwardingRuleEntity).run();
    await this._refreshRules();
  }

  private async _refreshRules(): Promise<void> {
    const db = await this._adaptor.ready();
    const rows = db.select()
      .from(portForwardingRuleEntity)
      .orderBy(asc(portForwardingRuleEntity.sort), asc(portForwardingRuleEntity.id))
      .all();
    this._rules$.next(rows);
  }
}
