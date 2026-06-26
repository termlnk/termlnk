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

import type { Api, Model } from '@earendil-works/pi-ai';
import type { ICustomModelDefinition, IModelOption, IModelOverrides, IProviderUserConfig } from '@termlnk/agent';

/**
 * 将用户覆盖合并到 Model<Api> — 对齐 pi-coding-agent 的 applyModelOverride
 */
export function applyModelOverride(model: Model<Api>, override: IModelOverrides): Model<Api> {
  const result = { ...model };

  if (override.name !== undefined) result.name = override.name;
  if (override.reasoning !== undefined) result.reasoning = override.reasoning;
  if (override.input !== undefined) result.input = override.input;
  if (override.contextWindow !== undefined) result.contextWindow = override.contextWindow;
  if (override.maxTokens !== undefined) result.maxTokens = override.maxTokens;

  if (override.cost) {
    result.cost = {
      input: override.cost.input ?? model.cost.input,
      output: override.cost.output ?? model.cost.output,
      cacheRead: override.cost.cacheRead ?? model.cost.cacheRead,
      cacheWrite: override.cost.cacheWrite ?? model.cost.cacheWrite,
    };
  }

  if (override.headers) {
    result.headers = { ...model.headers, ...override.headers };
  }

  if (override.compat) {
    result.compat = { ...model.compat, ...override.compat } as Model<Api>['compat'];
  }

  return result;
}

/**
 * 从 ICustomModelDefinition 构造 pi-ai Model<Api>
 */
export function buildModelFromCustomDef(
  providerId: string,
  providerConfig: IProviderUserConfig | undefined,
  def: ICustomModelDefinition
): Model<Api> {
  const defaultCost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  return {
    id: def.id,
    name: def.name ?? def.id,
    api: (def.api ?? providerConfig?.api ?? 'openai-completions') as Api,
    provider: providerId,
    baseUrl: def.baseUrl ?? providerConfig?.baseUrl ?? '',
    reasoning: def.reasoning ?? false,
    input: def.input ?? ['text'],
    cost: def.cost ?? defaultCost,
    contextWindow: def.contextWindow ?? 128000,
    maxTokens: def.maxTokens ?? 16384,
    headers: { ...providerConfig?.headers, ...def.headers },
    compat: def.compat,
  } as Model<Api>;
}

/**
 * Build a minimal fallback Model<Api> when resolveModel returns null.
 */
export function buildFallbackModel(
  providerId: string,
  modelId: string,
  providerConfig: IProviderUserConfig | undefined
): Model<Api> {
  return buildModelFromCustomDef(providerId, providerConfig, { id: modelId, name: modelId });
}

/**
 * 将 Model<Api> 转为 UI 层的 IModelOption
 */
export function toModelOption(providerId: string, model: Model<Api>, enabled: boolean): IModelOption {
  return {
    id: `${providerId}/${model.id}`,
    name: model.name ?? model.id,
    providerId,
    enabled,
    reasoning: model.reasoning ?? false,
    input: model.input ?? ['text'],
    contextWindow: model.contextWindow ?? 0,
    maxTokens: model.maxTokens ?? 0,
    cost: model.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
}
