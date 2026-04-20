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
import type { HookInputOf, HookOutputOf } from '../hooks/hook-contracts';
import type { ExtensionHookName } from '../hooks/hook-names';

// ---------------------------------------------------------------------------
// Logger / Storage / Secrets
// ---------------------------------------------------------------------------

export interface IExtensionLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

export interface IExtensionMemento {
  get<T>(key: string, defaultValue?: T): T | undefined;
  set(key: string, value: unknown): Promise<void>;
  keys(): readonly string[];
}

export interface ISecretStorage {
  get(key: string): Promise<string | undefined>;
  store(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Commands API
// ---------------------------------------------------------------------------

export interface IPluginCommandsAPI {
  register<TArgs extends unknown[] = unknown[], TResult = unknown>(
    commandId: string,
    handler: (...args: TArgs) => TResult | Promise<TResult>,
  ): IDisposable;
  execute<TResult = unknown, TArgs extends unknown[] = unknown[]>(
    commandId: string,
    ...args: TArgs
  ): Promise<TResult>;
}

// ---------------------------------------------------------------------------
// UI API (imperative — mirrors Alma/VSCode window namespace)
// ---------------------------------------------------------------------------

export type MessageType = 'info' | 'warning' | 'error' | 'success';

export interface IShowMessageOptions {
  modal?: boolean;
  detail?: string;
}

export interface IQuickPickItem<T = unknown> {
  label: string;
  description?: string;
  detail?: string;
  picked?: boolean;
  value?: T;
}

export interface IQuickPickOptions {
  title?: string;
  placeholder?: string;
  canPickMany?: boolean;
}

export interface IInputBoxOptions {
  title?: string;
  value?: string;
  placeholder?: string;
  password?: boolean;
  prompt?: string;
  validate?: (value: string) => string | null | undefined;
}

export interface IConfirmDialogOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

export interface IProgressOptions {
  title: string;
  cancellable?: boolean;
}

export interface IProgress {
  report(update: { message?: string; increment?: number }): void;
}

export interface IStatusBarItemOptions {
  id: string;
  text: string;
  alignment?: 'left' | 'right';
  priority?: number;
  command?: string;
  tooltip?: string;
  icon?: string;
  color?: string;
}

export interface IStatusBarItemHandle extends IDisposable {
  readonly id: string;
  update(patch: Partial<Omit<IStatusBarItemOptions, 'id'>>): void;
}

// ---------------------------------------------------------------------------
// Built-in UI parts that extensions may inject components into.
//
// This list is kept in sync with `BuiltInUIPart` in `@termlnk/ui` but
// duplicated here so the extension contract remains framework-agnostic.
// Extensions may also pass arbitrary strings to target custom mount points
// exposed by other plugins; the contract therefore accepts `string` as well.
// ---------------------------------------------------------------------------

export type ExtensionUIPart =
  | 'global'
  | 'floating'
  | 'header'
  | 'header-action'
  | 'header-trailing'
  | 'container'
  | 'footer'
  | 'content'
  | 'side-tab-bar'
  | 'right-sidebar'
  | 'tab-bar';

export interface IComponentRegistration {
  /**
   * Target mount point. Use one of the well-known `ExtensionUIPart` values
   * or a custom string slot published by another plugin.
   */
  readonly part: ExtensionUIPart | string;

  /**
   * Synchronous factory returning a React component. Extensions that need
   * code-splitting should wrap their import with `React.lazy(...)` and
   * return the lazy component from this factory.
   *
   * Typed as `unknown` to keep the extension contract free of a hard React
   * dependency; the host casts back to a React component type internally.
   */
  readonly component: () => unknown;

  /**
   * Larger numbers render later (on top). Default `0`. Useful when two
   * extensions both contribute to the same part and one should overlay.
   */
  readonly priority?: number;

  /**
   * Optional context expression gating visibility — evaluated by the host's
   * context service. Reserved for future use; currently always shown.
   */
  readonly when?: string;
}

export interface IPluginUIAPI {
  showNotification(
    type: MessageType,
    message: string,
    options?: IShowMessageOptions,
  ): Promise<string | undefined>;

  showQuickPick<T>(
    items: ReadonlyArray<IQuickPickItem<T>>,
    options?: IQuickPickOptions,
  ): Promise<IQuickPickItem<T> | ReadonlyArray<IQuickPickItem<T>> | undefined>;

  showInputBox(options?: IInputBoxOptions): Promise<string | undefined>;

  showConfirmDialog(options: IConfirmDialogOptions): Promise<boolean>;

  withProgress<T>(
    options: IProgressOptions,
    task: (progress: IProgress) => Promise<T>,
  ): Promise<T>;

  createStatusBarItem(options: IStatusBarItemOptions): IStatusBarItemHandle;

  /**
   * Inject a React component into a UI mount point. Returns a disposable
   * that removes the component — invoked automatically on extension
   * deactivation via `ExtensionDisposableScope`.
   */
  registerComponent(options: IComponentRegistration): IDisposable;
}

// ---------------------------------------------------------------------------
// Events API (VSCode-style Event<T> + interceptor hooks)
// ---------------------------------------------------------------------------

export type EventListener<TPayload> = (payload: TPayload) => void | Promise<void>;

export interface IEventHandle<TPayload> {
  (listener: EventListener<TPayload>): IDisposable;
}

export interface IHookContext<TInput, TOutput> {
  readonly input: TInput;
  readonly output: TOutput;
}

export type HookListener<TInput, TOutput> = (
  input: TInput,
  output: TOutput
) => void | Promise<void>;

export interface IHookOptions {
  priority?: number;
}

export interface IPluginEventsAPI {
  /**
   * Subscribe to a well-known host hook. The overloaded signature prefers
   * the strongly-typed `ExtensionHookName` variant so `input` and `output`
   * are inferred from `HookContractOf<T>`; a generic fallback overload
   * remains for extension-private event ids that carry custom shapes.
   */
  on<T extends ExtensionHookName>(
    hookId: T,
    listener: HookListener<HookInputOf<T>, HookOutputOf<T>>,
    options?: IHookOptions,
  ): IDisposable;
  on<TInput, TOutput>(
    hookId: string,
    listener: HookListener<TInput, TOutput>,
    options?: IHookOptions,
  ): IDisposable;

  emit<TPayload>(eventId: string, payload: TPayload): void;
}

// ---------------------------------------------------------------------------
// Tools API (AI agent tools)
// ---------------------------------------------------------------------------

export interface IToolDefinition<TParams = unknown, TResult = unknown> {
  id: string;
  displayName?: string;
  description?: string;
  schema?: unknown;
  handler: (params: TParams) => TResult | Promise<TResult>;
}

export interface IPluginToolsAPI {
  register<TParams = unknown, TResult = unknown>(
    definition: IToolDefinition<TParams, TResult>,
  ): IDisposable;
}

// ---------------------------------------------------------------------------
// Providers API (custom LLM providers)
// ---------------------------------------------------------------------------

/**
 * Kind of SDK the host should wrap the custom provider with. Extensions pass
 * this hint so the inference engine can choose an OpenAI / Anthropic /
 * Google adapter without inspecting the response shape.
 */
export type PluginProviderSdkType =
  | 'openai'
  | 'openai-compatible'
  | 'anthropic'
  | 'anthropic-messages'
  | 'google'
  | 'custom';

export interface IPluginProviderModelInfo {
  readonly id: string;
  readonly name: string;
  readonly contextWindow?: number;
  readonly maxTokens?: number;
}

export interface IPluginProviderChatRequest {
  readonly model: string;
  readonly messages: ReadonlyArray<{ role: 'user' | 'assistant' | 'system'; content: unknown }>;
  readonly stream?: boolean;
  readonly signal?: AbortSignal;
}

/**
 * Structural type that extensions implement when contributing a provider. The
 * `agent-ui` registry adapts this shape into `@termlnk/agent`'s internal
 * `IProviderDefinition` (same shape, different package).
 */
export interface IPluginProviderDefinition {
  readonly id: string;
  readonly name: string;
  readonly icon?: string;
  readonly sdkType?: PluginProviderSdkType;

  getModels: () => Promise<ReadonlyArray<IPluginProviderModelInfo>>;
  createChatCompletion: (request: IPluginProviderChatRequest) => Promise<ReadableStream | { content: string }>;
  initialize?: () => void | Promise<void>;
  isAuthenticated?: () => Promise<boolean>;
}

export interface IPluginProvidersAPI {
  register(definition: IPluginProviderDefinition): IDisposable;
}

// ---------------------------------------------------------------------------
// Settings / Workspace
// ---------------------------------------------------------------------------

export interface IPluginSettingsAPI {
  get<T>(section: string, defaultValue?: T): T | undefined;
  update(section: string, value: unknown): void;
  onDidChange(listener: (e: { section: string }) => void): IDisposable;
}

export interface IPluginWorkspaceAPI {
  readonly extensionPath: string;
  readonly storagePath: string;
  resolvePath(relative: string): string;
}

// ---------------------------------------------------------------------------
// PluginContext (passed to activate)
// ---------------------------------------------------------------------------

export interface IExtensionContext {
  readonly subscriptions: IDisposable[];
  readonly extensionId: string;
  readonly extensionPath: string;

  readonly globalState: IExtensionMemento;
  readonly secrets: ISecretStorage;
  readonly logger: IExtensionLogger;

  readonly commands: IPluginCommandsAPI;
  readonly ui: IPluginUIAPI;
  readonly events: IPluginEventsAPI;
  readonly tools: IPluginToolsAPI;
  readonly providers: IPluginProvidersAPI;
  readonly settings: IPluginSettingsAPI;
  readonly workspace: IPluginWorkspaceAPI;
}

/**
 * A plugin returns an `IPluginActivation` from its `activate()` function. The
 * `dispose` handle is invoked when the host unloads the extension.
 */
export interface IPluginActivation {
  dispose(): void | Promise<void>;
}

export type IPluginActivateFunction = (
  context: IExtensionContext
) => IPluginActivation | void | Promise<IPluginActivation | void>;
