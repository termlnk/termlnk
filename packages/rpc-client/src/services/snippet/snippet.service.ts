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

import type { ISnippet, ISnippetChangeEvent, ISnippetPackage, ISnippetService, ISnippetUpdate, SnippetItem, SnippetTree } from '@termlnk/snippet';
import type { Observable } from 'rxjs';
import { Disposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { IRPCClientService } from '../rpc-client.service';

export class SnippetClientService extends Disposable implements ISnippetService {
  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();
  }

  private get _client() {
    return this._rpcClientService.getClient().snippet;
  }

  async getAll(): Promise<ISnippet[]> {
    return this._client.getAll.query();
  }

  async getById(id: string): Promise<ISnippet | undefined> {
    const result = await this._client.getById.query(id);
    return result ?? undefined;
  }

  async getItem(id: string): Promise<SnippetItem | undefined> {
    const result = await this._client.getItem.query(id);
    return result ?? undefined;
  }

  async getChildrenList(pid: string): Promise<SnippetItem[]> {
    return this._client.getChildrenList.query(pid);
  }

  async create(snippet: Omit<ISnippet, 'id' | 'type'>): Promise<string> {
    return this._client.create.mutate(snippet);
  }

  async update(id: string, updates: ISnippetUpdate): Promise<void> {
    await this._client.update.mutate({ id, ...updates });
  }

  async delete(id: string): Promise<void> {
    await this._client.delete.mutate(id);
  }

  async getAllPackages(): Promise<ISnippetPackage[]> {
    return this._client.getAllPackages.query();
  }

  async getPackageById(id: string): Promise<ISnippetPackage | undefined> {
    const result = await this._client.getPackageById.query(id);
    return result ?? undefined;
  }

  async createPackage(pkg: Pick<ISnippetPackage, 'label' | 'pid'> & { sort?: number }): Promise<string> {
    return this._client.createPackage.mutate(pkg);
  }

  async updatePackage(id: string, updates: Partial<Omit<ISnippetPackage, 'id' | 'type'>>): Promise<void> {
    await this._client.updatePackage.mutate({ id, ...updates });
  }

  async deletePackage(id: string): Promise<void> {
    await this._client.deletePackage.mutate(id);
  }

  async getExpandedPackageIds(): Promise<string[]> {
    return this._client.getExpandedPackageIds.query();
  }

  async setExpandedPackageIds(ids: string[]): Promise<void> {
    await this._client.setExpandedPackageIds.mutate(ids);
  }

  async getTree(): Promise<SnippetTree[]> {
    return this._client.getTree.query();
  }

  async move(id: string, targetPid: string, targetSort: number): Promise<void> {
    await this._client.move.mutate({ id, targetPid, targetSort });
  }

  async paste(sessionId: string, content: string): Promise<void> {
    await this._client.paste.mutate({ sessionId, content });
  }

  async run(sessionId: string, content: string): Promise<void> {
    await this._client.run.mutate({ sessionId, content });
  }

  onChanged$(): Observable<ISnippetChangeEvent> {
    return trpcSubscriptionToObservable((opts) => this._client.onChanged$.subscribe(undefined, opts));
  }
}
