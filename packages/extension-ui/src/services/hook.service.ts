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
import type { HookListener, IHookOptions } from '@termlnk/extension';
import { createIdentifier, Disposable, ILogService, toDisposable } from '@termlnk/core';

interface IRegisteredHook<TInput = unknown, TOutput = unknown> {
  readonly listener: HookListener<TInput, TOutput>;
  readonly priority: number;
  readonly extensionId: string;
}

/**
 * An event bus that carries both one-way events and interceptor hooks.
 *
 * - `.emit(event, payload)` notifies every registered listener in priority
 *   order. Listeners may return a Promise; execution is awaited sequentially
 *   so that an upstream listener can mutate `output` before the next runs.
 * - `.on(hookId, listener, { priority })` registers an interceptor; the input
 *   is immutable but the output object is mutable and its fields are visible
 *   to subsequent listeners plus the host caller.
 *
 * Mirrors Alma's `ctx.events.on(hook, (input, output) => ...)` model.
 */
export interface IHookService {
  on<TInput, TOutput>(
    hookId: string,
    listener: HookListener<TInput, TOutput>,
    options?: IHookOptions & { extensionId: string },
  ): IDisposable;

  invoke<TInput, TOutput>(
    hookId: string,
    input: TInput,
    output: TOutput,
  ): Promise<TOutput>;

  emit<TPayload>(eventId: string, payload: TPayload): void;

  unregisterAllFor(extensionId: string): void;
}

export const IHookService = createIdentifier<IHookService>('extension.hook-service');

export class HookService extends Disposable implements IHookService {
  private readonly _hooks = new Map<string, Set<IRegisteredHook>>();

  constructor(
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  on<TInput, TOutput>(
    hookId: string,
    listener: HookListener<TInput, TOutput>,
    options?: IHookOptions & { extensionId: string }
  ): IDisposable {
    const registration: IRegisteredHook<TInput, TOutput> = {
      listener,
      priority: options?.priority ?? 0,
      extensionId: options?.extensionId ?? 'unknown',
    };

    const set = this._hooks.get(hookId) ?? new Set<IRegisteredHook>();
    set.add(registration as IRegisteredHook);
    this._hooks.set(hookId, set);

    return toDisposable(() => {
      set.delete(registration as IRegisteredHook);
      if (set.size === 0) {
        this._hooks.delete(hookId);
      }
    });
  }

  async invoke<TInput, TOutput>(hookId: string, input: TInput, output: TOutput): Promise<TOutput> {
    const set = this._hooks.get(hookId);
    if (!set || set.size === 0) {
      return output;
    }

    const ordered = [...set].sort((a, b) => b.priority - a.priority);
    for (const hook of ordered) {
      try {
        await (hook as IRegisteredHook<TInput, TOutput>).listener(input, output);
      } catch (err) {
        this._logService.error(
          '[HookService]',
          `Hook listener threw for "${hookId}" (ext: ${hook.extensionId})`,
          err
        );
      }
    }
    return output;
  }

  emit<TPayload>(eventId: string, payload: TPayload): void {
    void this.invoke(eventId, payload, {} as TPayload);
  }

  unregisterAllFor(extensionId: string): void {
    for (const [hookId, set] of this._hooks) {
      for (const hook of [...set]) {
        if (hook.extensionId === extensionId) {
          set.delete(hook);
        }
      }
      if (set.size === 0) {
        this._hooks.delete(hookId);
      }
    }
  }

  override dispose(): void {
    super.dispose();
    this._hooks.clear();
  }
}
