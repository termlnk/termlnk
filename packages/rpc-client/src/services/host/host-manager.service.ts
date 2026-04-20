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

import type { HostItem, HostTree, IHostChangeEvent } from '@termlnk/terminal';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { IRPCClientService } from '../rpc-client.service';

export interface IHostManagerService {
  tree(pid?: string): Promise<HostTree[]>;
  getChildrenList(pid?: string): Promise<HostItem[]>;
  getInfo(id: string): Promise<HostItem>;
  create(item: Partial<Pick<HostItem, 'id'>> & Omit<HostItem, 'id'>): Promise<string>;
  update(item: HostItem): Promise<void>;
  delete(id: string): Promise<void>;
  move(id: string, targetParentId: string, index: number): Promise<void>;
  getExpandedIds(): Promise<string[]>;
  setExpandedIds(ids: string[]): Promise<void>;
  copy(id: string): Promise<string>;
  onChanged$(): Observable<IHostChangeEvent>;
}
export const IHostManagerService = createIdentifier<IHostManagerService>('rpc-client.host-manager-service');

export class HostManagerService extends Disposable implements IHostManagerService {
  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();
  }

  async tree(id?: string): Promise<HostTree[]> {
    return this._getHostClient().tree.query(id);
  }

  async getChildrenList(pid?: string): Promise<HostItem[]> {
    return this._getHostClient().getChildrenList.query(pid);
  }

  async getInfo(id: string): Promise<HostItem> {
    return this._getHostClient().getInfo.query(id);
  }

  async create(item: Partial<Pick<HostItem, 'id'>> & Omit<HostItem, 'id'>): Promise<string> {
    return this._getHostClient().create.mutate(item);
  }

  async update(item: HostItem): Promise<void> {
    return this._getHostClient().update.mutate(item);
  }

  async delete(id: string): Promise<void> {
    return this._getHostClient().delete.mutate(id);
  }

  async move(id: string, targetParentId: string, index: number): Promise<void> {
    return this._getHostClient().move.mutate({ id, targetParentId, index });
  }

  async getExpandedIds(): Promise<string[]> {
    return this._getHostClient().getExpandedIds.query();
  }

  async setExpandedIds(ids: string[]): Promise<void> {
    return this._getHostClient().setExpandedIds.mutate(ids);
  }

  async copy(id: string): Promise<string> {
    return this._getHostClient().copy.mutate(id);
  }

  onChanged$(): Observable<IHostChangeEvent> {
    return trpcSubscriptionToObservable((opts) => this._getHostClient().onChanged$.subscribe(undefined, opts));
  }

  private _getHostClient() {
    return this._rpcClientService.getClient().host;
  }
}
