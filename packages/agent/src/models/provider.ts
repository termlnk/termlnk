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

/**
 * LLM provider runtime object.
 *
 * Built-in provider: models come from pi-ai getModels(), merged with user config at runtime.
 * Custom provider: model definitions stored in DB, Model<Api> constructed at runtime.
 */
export interface ILLMProvider {
  /** Provider ID — KnownProvider value for built-in, nanoid for custom */
  id: string;
  /** Display name */
  name: string;
  /** Whether enabled */
  enabled: boolean;
  /** Whether this is a pi-ai built-in provider */
  builtin: boolean;
  /** API type */
  api: Api;
  /** API key */
  apiKey?: string;
  /** API base URL (overrides pi-ai default) */
  baseUrl?: string;
  /** Custom request headers */
  headers?: Record<string, string>;
  /** Sort weight (lower = higher priority) */
  sort: number;
  /** Model list — uses pi-ai Model<Api> type directly */
  models: Model<Api>[];
}

/**
 * Provider user config (DB-persisted + RPC transport).
 * Only stores user-modified fields; no pi-ai built-in data.
 */
export interface IProviderUserConfig {
  providerId: string;
  name?: string;
  enabled: boolean;
  api?: Api;
  apiKey?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  sort?: number;
}

/**
 * Model user config (DB-persisted + RPC transport).
 */
export interface IModelUserConfig {
  providerId: string;
  modelId: string;
  enabled: boolean;
  overrides?: IModelOverrides;
}

/**
 * Model parameter overrides — mirrors pi-coding-agent ModelOverride.
 * Only user-customizable fields, merged onto Model<Api>.
 */
export interface IModelOverrides {
  name?: string;
  maxTokens?: number;
  contextWindow?: number;
  reasoning?: boolean;
  input?: ('text' | 'image')[];
  cost?: Partial<Model<Api>['cost']>;
  headers?: Record<string, string>;
  compat?: Model<Api>['compat'];
}

/**
 * Full custom model definition — mirrors pi-coding-agent ModelDefinitionSchema.
 * For models not in the pi-ai built-in list; constructed into Model<Api> at runtime.
 */
export interface ICustomModelDefinition {
  id: string;
  name?: string;
  api?: Api;
  baseUrl?: string;
  reasoning?: boolean;
  input?: ('text' | 'image')[];
  cost?: Model<Api>['cost'];
  contextWindow?: number;
  maxTokens?: number;
  headers?: Record<string, string>;
  compat?: Model<Api>['compat'];
}

/**
 * UI layer model option.
 * Extracts only the fields the UI needs from Model<Api> to avoid transferring the full object.
 */
export interface IModelOption {
  /** Globally unique ID: '{providerId}/{modelId}' */
  id: string;
  name: string;
  providerId: string;
  enabled: boolean;
  reasoning: boolean;
  input: Model<Api>['input'];
  contextWindow: number;
  maxTokens: number;
  cost: Model<Api>['cost'];
}

/**
 * UI layer provider group (lightweight type for RPC transport).
 */
export interface IProviderGroup {
  id: string;
  name: string;
  enabled: boolean;
  builtin: boolean;
  api: Api;
  models: IModelOption[];
}
