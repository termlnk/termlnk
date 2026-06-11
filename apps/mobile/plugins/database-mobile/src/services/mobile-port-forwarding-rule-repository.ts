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
import type { IMobilePortForwardingRule, IMobilePortForwardingRuleType } from '../types';
import { createIdentifier, Disposable, generateRandomId, Inject } from '@termlnk/core';
import { asc, eq } from 'drizzle-orm';
import { BehaviorSubject, Subject } from 'rxjs';
import { portForwardingRuleEntity } from '../entities/port-forwarding-rule';
import { IDatabaseMobileAdaptorService } from './database-mobile-adaptor.service';

function nowIso(): string {
  return new Date().toISOString();
}

interface IPortForwardingRuleWire {
  readonly id: string;
  readonly name?: string | null;
  readonly type?: IMobilePortForwardingRuleType | null;
  readonly hostId?: string | null;
  readonly bindAddress?: string | null;
  readonly bindPort?: number | null;
  readonly destHost?: string | null;
  readonly destPort?: number | null;
  readonly autoStart?: boolean | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
}

export interface IMobilePortForwardingRuleRepository extends IPortForwardingRuleSyncRepository {
  readonly portForwardingRules$: Observable<readonly IMobilePortForwardingRule[]>;
  ready(): Promise<void>;
  createPortForwardingRule(input: {
    readonly name?: string | null;
    readonly type: IMobilePortForwardingRuleType;
    readonly hostId: string;
    readonly bindAddress: string;
    readonly bindPort: number;
    readonly destHost?: string | null;
    readonly destPort?: number | null;
    readonly autoStart?: boolean;
  }): Promise<string>;
  updatePortForwardingRule(input: {
    readonly id: string;
    readonly name?: string | null;
    readonly type: IMobilePortForwardingRuleType;
    readonly hostId: string;
    readonly bindAddress: string;
    readonly bindPort: number;
    readonly destHost?: string | null;
    readonly destPort?: number | null;
    readonly autoStart?: boolean;
  }): Promise<void>;
  deletePortForwardingRule(id: string): Promise<void>;
}

export const IMobilePortForwardingRuleRepository = createIdentifier<IMobilePortForwardingRuleRepository>('mobile.port-forwarding-rule-repository');

export class MobilePortForwardingRuleRepository extends Disposable implements IMobilePortForwardingRuleRepository {
  private readonly _portForwardingRules$ = new BehaviorSubject<readonly IMobilePortForwardingRule[]>([]);
  readonly portForwardingRules$: Observable<readonly IMobilePortForwardingRule[]> = this._portForwardingRules$.asObservable();

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
    this._portForwardingRules$.complete();
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
    const rows = db.select().from(portForwardingRuleEntity).all();
    return rows.map((row) => this._toSyncRow(row));
  }

  async getById(id: string): Promise<ISyncEntityRow | null> {
    const db = await this._adaptor.ready();
    const row = db.select().from(portForwardingRuleEntity).where(eq(portForwardingRuleEntity.id, id)).get();
    return row ? this._toSyncRow(row) : null;
  }

  async syncUpsertRow(entity: ISyncEntityRow): Promise<void> {
    const existing = await this.getById(entity.id);
    await this._persist(this._normaliseWire(entity as unknown as IPortForwardingRuleWire));
    await this._refresh();
    this._changed$.next({ type: existing ? 'update' : 'add', id: entity.id });
  }

  async delete(id: string): Promise<void> {
    const db = await this._adaptor.ready();
    db.delete(portForwardingRuleEntity).where(eq(portForwardingRuleEntity.id, id)).run();
    await this._refresh();
    this._changed$.next({ type: 'delete', id });
  }

  async createPortForwardingRule(input: {
    readonly name?: string | null;
    readonly type: IMobilePortForwardingRuleType;
    readonly hostId: string;
    readonly bindAddress: string;
    readonly bindPort: number;
    readonly destHost?: string | null;
    readonly destPort?: number | null;
    readonly autoStart?: boolean;
  }): Promise<string> {
    const id = generateRandomId(24);
    const now = nowIso();
    await this._persist({
      id,
      name: input.name ?? null,
      type: input.type,
      hostId: input.hostId,
      bindAddress: input.bindAddress,
      bindPort: input.bindPort,
      destHost: input.destHost ?? null,
      destPort: input.destPort ?? null,
      autoStart: input.autoStart ?? false,
      createdAt: now,
      updatedAt: now,
    });
    await this._refresh();
    this._changed$.next({ type: 'add', id });
    return id;
  }

  async updatePortForwardingRule(input: {
    readonly id: string;
    readonly name?: string | null;
    readonly type: IMobilePortForwardingRuleType;
    readonly hostId: string;
    readonly bindAddress: string;
    readonly bindPort: number;
    readonly destHost?: string | null;
    readonly destPort?: number | null;
    readonly autoStart?: boolean;
  }): Promise<void> {
    const db = await this._adaptor.ready();
    const existing = db.select().from(portForwardingRuleEntity).where(eq(portForwardingRuleEntity.id, input.id)).get();
    await this._persist({
      id: input.id,
      name: input.name ?? null,
      type: input.type,
      hostId: input.hostId,
      bindAddress: input.bindAddress,
      bindPort: input.bindPort,
      destHost: input.destHost ?? null,
      destPort: input.destPort ?? null,
      autoStart: input.autoStart ?? false,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    });
    await this._refresh();
    this._changed$.next({ type: 'update', id: input.id });
  }

  async deletePortForwardingRule(id: string): Promise<void> {
    await this.delete(id);
  }

  private _toSyncRow(row: IPortForwardingRuleEntity): ISyncEntityRow {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      hostId: row.hostId,
      bindAddress: row.bindAddress,
      bindPort: row.bindPort,
      destHost: row.destHost,
      destPort: row.destPort,
      autoStart: row.autoStart,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } as unknown as ISyncEntityRow;
  }

  private _normaliseWire(row: IPortForwardingRuleWire): IMobilePortForwardingRule {
    const now = nowIso();
    return {
      id: row.id,
      name: row.name ?? null,
      type: row.type ?? 'local',
      hostId: row.hostId ?? '',
      bindAddress: row.bindAddress ?? '127.0.0.1',
      bindPort: row.bindPort ?? 0,
      destHost: row.destHost ?? null,
      destPort: row.destPort ?? null,
      autoStart: row.autoStart ?? false,
      createdAt: row.createdAt ?? now,
      updatedAt: row.updatedAt ?? now,
    };
  }

  private async _persist(row: IMobilePortForwardingRule): Promise<void> {
    const db = await this._adaptor.ready();
    db.insert(portForwardingRuleEntity)
      .values({
        id: row.id,
        name: row.name ?? null,
        type: row.type,
        hostId: row.hostId,
        bindAddress: row.bindAddress,
        bindPort: row.bindPort,
        destHost: row.destHost ?? null,
        destPort: row.destPort ?? null,
        autoStart: row.autoStart,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })
      .onConflictDoUpdate({
        target: portForwardingRuleEntity.id,
        set: {
          name: row.name ?? null,
          type: row.type,
          hostId: row.hostId,
          bindAddress: row.bindAddress,
          bindPort: row.bindPort,
          destHost: row.destHost ?? null,
          destPort: row.destPort ?? null,
          autoStart: row.autoStart,
          updatedAt: row.updatedAt,
        },
      })
      .run();
  }

  private async _refresh(): Promise<void> {
    const db = await this._adaptor.ready();
    const rows = db.select().from(portForwardingRuleEntity).orderBy(asc(portForwardingRuleEntity.hostId), asc(portForwardingRuleEntity.name)).all();
    this._portForwardingRules$.next(rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      hostId: row.hostId,
      bindAddress: row.bindAddress,
      bindPort: row.bindPort,
      destHost: row.destHost,
      destPort: row.destPort,
      autoStart: row.autoStart,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })));
  }
}
