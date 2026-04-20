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

/**
 * Legacy compatibility re-exports.
 *
 * Termlnk's extension model (Alma-style) exposes all APIs via the single
 * `IExtensionContext` object passed to `activate(context)`. There is no
 * free-standing `termlnk.xxx` namespace. This file simply re-exports the
 * context-scoped API types for callers that still import from
 * `@termlnk/extension/api/extension-api`.
 */
export type {
  EventListener,
  HookListener,
  IConfirmDialogOptions,
  IEventHandle,
  IExtensionContext,
  IHookContext,
  IHookOptions,
  IInputBoxOptions,
  IPluginActivateFunction,
  IPluginActivation,
  IPluginCommandsAPI,
  IPluginEventsAPI,
  IPluginSettingsAPI,
  IPluginToolsAPI,
  IPluginUIAPI,
  IPluginWorkspaceAPI,
  IProgress,
  IProgressOptions,
  IQuickPickItem,
  IQuickPickOptions,
  IShowMessageOptions,
  IStatusBarItemHandle,
  IStatusBarItemOptions,
  IToolDefinition,
  MessageType,
} from './extension-context';
