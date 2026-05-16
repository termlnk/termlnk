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

// ---------------------------------------------------------------------------
// Runtime provider type — direct reuse of pi-ai Model<Api>
// ---------------------------------------------------------------------------

/**
 * LLM 提供商运行时对象
 *
 * 内置提供商: 模型来自 pi-ai getModels()，运行时合并用户配置
 * 自定义提供商: 模型定义存储在数据库，运行时构造 Model<Api> 对象
 */
export interface ILLMProvider {
  /** 提供商 ID，内置使用 KnownProvider 值，自定义使用 nanoid */
  id: string;
  /** 显示名称 */
  name: string;
  /** 是否启用 */
  enabled: boolean;
  /** 是否为 pi-ai 内置提供商 */
  builtin: boolean;
  /** API 接口类型 */
  api: Api;
  /** API 密钥 */
  apiKey?: string;
  /** API 基础地址（覆盖 pi-ai 默认值） */
  baseUrl?: string;
  /** 自定义请求头 */
  headers?: Record<string, string>;
  /** 排序权重（越小越靠前） */
  sort: number;
  /** 模型列表 — 直接使用 pi-ai 的 Model<Api> 类型 */
  models: Model<Api>[];
}

// ---------------------------------------------------------------------------
// User config types — stored as delta in database
// ---------------------------------------------------------------------------

/**
 * 提供商用户配置（数据库持久化 + RPC 传输）
 * 仅存储用户修改的字段，不含 pi-ai 内置数据
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
 * 模型用户配置（数据库持久化 + RPC 传输）
 */
export interface IModelUserConfig {
  providerId: string;
  modelId: string;
  enabled: boolean;
  overrides?: IModelOverrides;
}

/**
 * 模型参数覆盖 — 对齐 pi-coding-agent ModelOverride
 * 仅包含用户可自定义的字段，合并到 Model<Api> 上
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
 * 自定义模型完整定义 — 对齐 pi-coding-agent ModelDefinitionSchema
 * 用于不在 pi-ai 内置列表中的自定义模型，运行时构造为 Model<Api>
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

// ---------------------------------------------------------------------------
// UI layer lightweight types — for RPC transport
// ---------------------------------------------------------------------------

/**
 * UI 层 - 模型选项
 * 从 Model<Api> 提取 UI 需要的字段，避免传输完整 Model 对象
 */
export interface IModelOption {
  /** 全局唯一 ID: '{providerId}/{modelId}' */
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
 * UI 层 - 提供商分组（RPC 传输用轻量类型）
 */
export interface IProviderGroup {
  id: string;
  name: string;
  enabled: boolean;
  builtin: boolean;
  api: Api;
  models: IModelOption[];
}
