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

import type { IAddSkillRepositoryInput, ISkill, ISkillChangeEvent, ISkillRepository, ISkillRepositoryMarketplaceItem, ISkillService, IUpdateSkillRepositoryInput } from '@termlnk/agent';
import type { Observable } from 'rxjs';
import { Disposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { IRPCClientService } from '../rpc-client.service';

export class SkillService extends Disposable implements ISkillService {
  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();
  }

  private get _client() {
    return this._rpcClientService.getClient().skill;
  }

  async getAll(): Promise<ISkill[]> {
    return this._client.getAll.query();
  }

  async getEnabled(): Promise<ISkill[]> {
    return this._client.getEnabled.query();
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    await this._client.setEnabled.mutate({ id, enabled });
  }

  async setSortOrder(id: string, sortOrder: number): Promise<void> {
    await this._client.setSortOrder.mutate({ id, sortOrder });
  }

  async getContent(id: string): Promise<string> {
    return this._client.getContent.query(id);
  }

  async refresh(): Promise<void> {
    await this._client.refresh.mutate();
  }

  async getRepositories(): Promise<ISkillRepository[]> {
    return this._client.getRepositories.query();
  }

  async addRepository(input: IAddSkillRepositoryInput): Promise<ISkillRepository> {
    return this._client.addRepository.mutate(input);
  }

  async updateRepository(input: IUpdateSkillRepositoryInput): Promise<ISkillRepository> {
    return this._client.updateRepository.mutate(input);
  }

  async removeRepository(id: string): Promise<void> {
    await this._client.removeRepository.mutate(id);
  }

  async uninstall(id: string): Promise<void> {
    await this._client.uninstall.mutate(id);
  }

  async getRepositoryMarketplaceItems(repositoryId?: string): Promise<ISkillRepositoryMarketplaceItem[]> {
    return this._client.getRepositoryMarketplaceItems.query(repositoryId);
  }

  async installRepositorySkill(id: string): Promise<void> {
    await this._client.installRepositorySkill.mutate(id);
  }

  onChanged$(): Observable<ISkillChangeEvent> {
    return trpcSubscriptionToObservable((opts) => this._client.onChanged$.subscribe(undefined, opts));
  }
}
