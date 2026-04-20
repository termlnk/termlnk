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

import type { IConfigChangeEvent, IConfigEntry } from '@termlnk/rpc-server';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { IRPCClientService } from '../rpc-client.service';

export interface IConfigManagerService {
  get<T = unknown>(key: string): Promise<T | null>;
  getMany(keys: string[]): Promise<Record<string, unknown>>;
  set(key: string, value: unknown): Promise<void>;
  setMany(entries: IConfigEntry[]): Promise<void>;
  delete(key: string): Promise<void>;
  getAll(): Promise<IConfigEntry[]>;
  getField<T = unknown>(key: string, field: string): Promise<T | null>;
  setField(key: string, field: string, value: unknown): Promise<void>;
  deleteField(key: string, field: string): Promise<void>;
  onChanged$(): Observable<IConfigChangeEvent>;
}
export const IConfigManagerService = createIdentifier<IConfigManagerService>('rpc-client.config-manager-service');

export class ConfigManagerService extends Disposable implements IConfigManagerService {
  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();
  }

  private get _client() {
    return this._rpcClientService.getClient().config;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    return this._client.get.query(key) as Promise<T | null>;
  }

  async getMany(keys: string[]): Promise<Record<string, unknown>> {
    return this._client.getMany.query(keys);
  }

  async set(key: string, value: unknown): Promise<void> {
    await this._client.set.mutate({ key, value });
  }

  async setMany(entries: IConfigEntry[]): Promise<void> {
    await this._client.setMany.mutate(entries);
  }

  async delete(key: string): Promise<void> {
    await this._client.delete.mutate(key);
  }

  async getAll(): Promise<IConfigEntry[]> {
    const rows = await this._client.getAll.query();
    return rows.map((row) => ({ key: row.key, value: row.value ?? null }));
  }

  async getField<T = unknown>(key: string, field: string): Promise<T | null> {
    return this._client.getField.query({ key, field }) as Promise<T | null>;
  }

  async setField(key: string, field: string, value: unknown): Promise<void> {
    await this._client.setField.mutate({ key, field, value });
  }

  async deleteField(key: string, field: string): Promise<void> {
    await this._client.deleteField.mutate({ key, field });
  }

  onChanged$(): Observable<IConfigChangeEvent> {
    return trpcSubscriptionToObservable((opts) => this._client.onChanged$.subscribe(undefined, opts));
  }
}
