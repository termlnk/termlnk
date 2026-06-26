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

import type { Api, AssistantMessage, AssistantMessageEventStream, Context, Model, SimpleStreamOptions } from '@earendil-works/pi-ai';
import type { Observable } from 'rxjs';
import type { ICustomModelDefinition, IModelOption, IModelOverrides, IProviderGroup, IProviderUserConfig } from '../models/provider';
import { createIdentifier } from '@termlnk/core';

export interface ILLMProviderService {
  readonly providers$: Observable<IProviderGroup[]>;
  readonly activeModelId$: Observable<string | null>;
  readonly activeModel$: Observable<IModelOption | null>;
  readonly activeProvider$: Observable<IProviderUserConfig | null>;

  initialize(): Promise<void>;

  addProvider(config: IProviderUserConfig): Promise<void>;
  removeProvider(providerId: string): Promise<void>;
  updateProviderConfig(providerId: string, patch: Partial<IProviderUserConfig>): Promise<void>;
  getProviderConfig(providerId: string): IProviderUserConfig | null;
  getProviders(): IProviderGroup[];
  getAvailableModels(): IProviderGroup[];

  refreshProviderModels(providerId: string): Promise<string[]>;
  testProviderModel(providerId: string, modelId: string, signal?: AbortSignal): Promise<{ latencyMs: number }>;
  setActiveModel(modelId: string): void;
  getActiveModel(): IModelOption | null;
  toggleModel(providerId: string, modelId: string, enabled: boolean): Promise<void>;
  updateModelOverrides(providerId: string, modelId: string, overrides: IModelOverrides): Promise<void>;
  resetModelOverrides(providerId: string, modelId: string): Promise<void>;

  addCustomModel(providerId: string, model: ICustomModelDefinition): Promise<void>;
  removeCustomModel(providerId: string, modelId: string): Promise<void>;

  resolveModel(providerId: string, modelId: string): Model<Api> | null;

  streamSimple(model: Model<Api>, context: Context, options?: SimpleStreamOptions): AssistantMessageEventStream;
  completeSimple(model: Model<Api>, context: Context, options?: SimpleStreamOptions): Promise<AssistantMessage>;
}

export const ILLMProviderService = createIdentifier<ILLMProviderService>('agent.provider-config-service');
