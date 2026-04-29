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

import type { ICustomModelDefinition, IModelOption, IModelOverrides, IProviderGroup, IProviderUserConfig } from '@termlnk/agent';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { IRPCClientService } from '../rpc-client.service';

export interface IProviderConfigClientService {
  readonly providers$: Observable<IProviderGroup[]>;
  readonly activeModelId$: Observable<string | null>;
  readonly activeModel$: Observable<IModelOption | null>;
  readonly activeProvider$: Observable<IProviderUserConfig | null>;

  addProvider(config: IProviderUserConfig): Promise<void>;
  removeProvider(providerId: string): Promise<void>;
  updateProviderConfig(providerId: string, patch: Partial<IProviderUserConfig>): Promise<void>;
  getProviderConfig(providerId: string): Promise<IProviderUserConfig | null>;
  refreshProviderModels(providerId: string): Promise<string[]>;
  testProviderModel(providerId: string, modelId: string): Promise<{ latencyMs: number }>;
  setActiveModel(modelId: string): Promise<void>;
  getProviders(): Promise<IProviderGroup[]>;
  getActiveModel(): Promise<IModelOption | null>;

  toggleModel(providerId: string, modelId: string, enabled: boolean): Promise<void>;
  updateModelOverrides(providerId: string, modelId: string, overrides: IModelOverrides): Promise<void>;
  resetModelOverrides(providerId: string, modelId: string): Promise<void>;
  addCustomModel(providerId: string, model: ICustomModelDefinition): Promise<void>;
  removeCustomModel(providerId: string, modelId: string): Promise<void>;
}

export const IProviderConfigClientService = createIdentifier<IProviderConfigClientService>('rpc-client.provider-config-client-service');

export class ProviderConfigClientService extends Disposable implements IProviderConfigClientService {
  readonly providers$: Observable<IProviderGroup[]>;
  readonly activeModelId$: Observable<string | null>;
  readonly activeModel$: Observable<IModelOption | null>;
  readonly activeProvider$: Observable<IProviderUserConfig | null>;

  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();

    this.providers$ = trpcSubscriptionToObservable<IProviderGroup[]>((opts) =>
      this._client.providers$.subscribe(undefined, opts)
    );

    this.activeModelId$ = trpcSubscriptionToObservable<string | null>((opts) =>
      this._client.activeModelId$.subscribe(undefined, opts)
    );

    this.activeModel$ = trpcSubscriptionToObservable<IModelOption | null>((opts) =>
      this._client.activeModel$.subscribe(undefined, opts)
    );

    this.activeProvider$ = trpcSubscriptionToObservable<IProviderUserConfig | null>((opts) =>
      this._client.activeProvider$.subscribe(undefined, opts)
    );
  }

  private get _client() {
    return this._rpcClientService.getClient().ai;
  }

  async addProvider(config: IProviderUserConfig): Promise<void> {
    await this._client.addProvider.mutate(config);
  }

  async removeProvider(providerId: string): Promise<void> {
    await this._client.removeProvider.mutate({ providerId });
  }

  async updateProviderConfig(providerId: string, patch: Partial<IProviderUserConfig>): Promise<void> {
    await this._client.updateProviderConfig.mutate({ providerId, patch });
  }

  async getProviderConfig(providerId: string): Promise<IProviderUserConfig | null> {
    return this._client.getProviderConfig.query({ providerId });
  }

  async refreshProviderModels(providerId: string): Promise<string[]> {
    return this._client.refreshProviderModels.mutate({ providerId });
  }

  async testProviderModel(providerId: string, modelId: string): Promise<{ latencyMs: number }> {
    return this._client.testProviderModel.mutate({ providerId, modelId });
  }

  async setActiveModel(modelId: string): Promise<void> {
    await this._client.setActiveModel.mutate({ modelId });
  }

  async getProviders(): Promise<IProviderGroup[]> {
    return this._client.getProviders.query();
  }

  async getActiveModel(): Promise<IModelOption | null> {
    return this._client.getActiveModel.query();
  }

  async toggleModel(providerId: string, modelId: string, enabled: boolean): Promise<void> {
    await this._client.toggleModel.mutate({ providerId, modelId, enabled });
  }

  async updateModelOverrides(providerId: string, modelId: string, overrides: IModelOverrides): Promise<void> {
    await this._client.updateModelOverrides.mutate({ providerId, modelId, overrides });
  }

  async resetModelOverrides(providerId: string, modelId: string): Promise<void> {
    await this._client.resetModelOverrides.mutate({ providerId, modelId });
  }

  async addCustomModel(providerId: string, model: ICustomModelDefinition): Promise<void> {
    await this._client.addCustomModel.mutate({ providerId, model });
  }

  async removeCustomModel(providerId: string, modelId: string): Promise<void> {
    await this._client.removeCustomModel.mutate({ providerId, modelId });
  }
}
