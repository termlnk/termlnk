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

import type { IDisposable } from '@termlnk/core';
import type { Observable } from 'rxjs';
import { createIdentifier } from '@termlnk/core';

/**
 * Kind of SDK the host should wrap the custom provider with. The agent-core
 * inference engine uses this to pick the correct `@ai-sdk/<provider>` adapter
 * or falls back to a generic OpenAI-compatible wrapper.
 */
export type ProviderSdkType =
  | 'openai'
  | 'openai-compatible'
  | 'anthropic'
  | 'anthropic-messages'
  | 'google'
  | 'custom';

export interface IProviderModelInfo {
  readonly id: string;
  readonly name: string;
  readonly contextWindow?: number;
  readonly maxTokens?: number;
}

export interface IProviderChatRequest {
  readonly model: string;
  readonly messages: ReadonlyArray<{ role: 'user' | 'assistant' | 'system'; content: unknown }>;
  readonly stream?: boolean;
  readonly signal?: AbortSignal;
}

/**
 * Minimal shape an extension must provide when registering a custom provider.
 *
 * `createChatCompletion` returns either a full response or a `ReadableStream`
 * — the host will wrap it with the matching `@ai-sdk/<sdkType>` adapter so
 * the rest of the inference engine works unchanged.
 */
export interface IProviderDefinition {
  readonly id: string;
  readonly name: string;
  readonly icon?: string;
  readonly sdkType?: ProviderSdkType;

  getModels: () => Promise<ReadonlyArray<IProviderModelInfo>>;
  createChatCompletion: (request: IProviderChatRequest) => Promise<ReadableStream | { content: string }>;

  /** Optional: called once when the provider is first registered. */
  initialize?: () => void | Promise<void>;

  /** Optional: whether the provider is currently authenticated/usable. */
  isAuthenticated?: () => Promise<boolean>;
}

/**
 * A live provider entry held by the registry. Extensions do not see this
 * shape directly — it is exposed to consumers (settings UI, inference
 * engine) that want to enumerate contributed providers alongside built-in
 * ones.
 */
export interface IRegisteredProvider {
  readonly extensionId: string;
  readonly definition: IProviderDefinition;
}

/**
 * Registry of providers contributed at runtime (typically by extensions).
 *
 * Built-in providers and user-configured providers are **not** tracked
 * here — they flow through `ILLMProviderService`. Consumers that want the
 * full set of "providers the user can pick from" merge both sources.
 */
export interface IProviderRegistryService {
  readonly providers$: Observable<ReadonlyArray<IRegisteredProvider>>;

  /** List currently-registered providers. */
  list(): ReadonlyArray<IRegisteredProvider>;

  /** Look up a provider by `extensionId::providerId`. */
  get(extensionId: string, providerId: string): IRegisteredProvider | undefined;

  /**
   * Register a provider on behalf of the given extension. The returned
   * disposable removes the entry — extensions should pass this through their
   * `ExtensionDisposableScope` (done automatically by `PluginContext`).
   */
  register(extensionId: string, definition: IProviderDefinition): IDisposable;
}

export const IProviderRegistryService = createIdentifier<IProviderRegistryService>('agent.provider-registry-service');
