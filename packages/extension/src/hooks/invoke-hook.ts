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

import type { HookInputOf, HookOutputOf } from './hook-contracts';
import type { ExtensionHookName } from './hook-names';

/**
 * Minimal host-facing hook bus interface.
 *
 * The extension UI layer provides the real `IHookService`; the shape is
 * re-declared here so host business code can call `invokeHook(...)` without
 * importing `@termlnk/extension-ui` (which would invert the dep direction).
 */
export interface IHookInvokable {
  invoke<TInput, TOutput>(
    hookId: string,
    input: TInput,
    output: TOutput,
  ): Promise<TOutput>;
}

/**
 * Call site helper that wires a business code path into a well-known hook.
 *
 * Usage:
 *
 * ```ts
 * const out = await invokeHook(
 *   this._hookService,
 *   'chat.message.willSend',
 *   { threadId, content, model, providerId },
 *   { content: undefined, cancel: false },
 * );
 * if (out.cancel) {
 *   return;
 * }
 * const finalContent = out.content ?? content;
 * ```
 *
 * The strong `T extends ExtensionHookName` constraint guarantees that
 * `input` and `initialOutput` match the shape declared in
 * `HookContractOf<T>`, catching typos at compile time.
 */
export function invokeHook<T extends ExtensionHookName>(
  hookService: IHookInvokable,
  name: T,
  input: HookInputOf<T>,
  initialOutput: HookOutputOf<T>
): Promise<HookOutputOf<T>> {
  return hookService.invoke<HookInputOf<T>, HookOutputOf<T>>(name, input, initialOutput);
}
