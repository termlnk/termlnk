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

import type { ExtensionHookName } from './hook-names';

/**
 * A hook contract pairs an **input** (read-only payload describing what is
 * about to happen, or what just happened) with a mutable **output** object
 * that listeners can patch to influence the outcome. `cancel: true` on a
 * `will*` hook signals the host to abort; other keys are hook-specific.
 */
export interface IHookContract<TInput, TOutput> {
  readonly input: TInput;
  readonly output: TOutput;
}

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

export interface ITokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly cachedInputTokens?: number;
}

export interface IModelPricing {
  readonly input?: number;
  readonly output?: number;
  readonly cacheRead?: number;
}

export interface IToolExecutionContext {
  readonly threadId?: string;
  readonly messageId?: string;
  readonly sessionId?: string;
}

export interface ITerminalSessionSnapshot {
  readonly sessionId: string;
  readonly title: string;
  readonly type: string;
  readonly hostId?: string;
}

// ---------------------------------------------------------------------------
// Condition-type contract map
// ---------------------------------------------------------------------------

export type HookContractOf<T extends ExtensionHookName> =
  T extends 'chat.message.willSend' ? IHookContract<
    { threadId: string; content: string; model: string; providerId: string },
    { content?: string; cancel?: boolean }
  > :
    T extends 'chat.message.didSend' ? IHookContract<
      { threadId: string; messageId: string; content: string; model: string; providerId: string },
      Record<string, never>
    > :
      T extends 'chat.message.didReceive' ? IHookContract<
        {
          threadId: string;
          messageId: string;
          model: string;
          providerId: string;
          response: { content: string; usage?: ITokenUsage };
          pricing?: IModelPricing;
        },
        Record<string, never>
      > :
        T extends 'chat.thread.created' ? IHookContract<
          { threadId: string; title: string; model?: string },
          Record<string, never>
        > :
          T extends 'chat.thread.activated' ? IHookContract<
            { threadId: string; title?: string; model?: string; providerId?: string; usage?: ITokenUsage; pricing?: IModelPricing },
            Record<string, never>
          > :
            T extends 'chat.thread.deleted' ? IHookContract<
              { threadId: string },
              Record<string, never>
            > :
              T extends 'tool.willExecute' ? IHookContract<
                { tool: string; args: Record<string, unknown>; context: IToolExecutionContext },
                { args?: Record<string, unknown>; cancel?: boolean }
              > :
                T extends 'tool.didExecute' ? IHookContract<
                  { tool: string; args: Record<string, unknown>; result: unknown; duration: number; context: IToolExecutionContext },
                  { result?: unknown }
                > :
                  T extends 'tool.onError' ? IHookContract<
                    { tool: string; args: Record<string, unknown>; error: { message: string; stack?: string }; duration: number; context: IToolExecutionContext },
                    { result?: unknown; rethrow?: boolean }
                  > :
                    T extends 'terminal.session.willOpen' ? IHookContract<
                      { type: string; hostId?: string; title: string },
                      { cancel?: boolean; title?: string }
                    > :
                      T extends 'terminal.session.didOpen' ? IHookContract<
                        ITerminalSessionSnapshot,
                        Record<string, never>
                      > :
                        T extends 'terminal.session.didClose' ? IHookContract<
                          ITerminalSessionSnapshot,
                          Record<string, never>
                        > :
                          T extends 'terminal.output.didReceive' ? IHookContract<
                            { sessionId: string; chunk: string },
                            Record<string, never>
                          > :
                            T extends 'ssh.connection.willEstablish' ? IHookContract<
                              { hostId: string; host: string; port: number; username: string },
                              { cancel?: boolean }
                            > :
                              T extends 'ssh.connection.didEstablish' ? IHookContract<
                                { hostId: string; host: string; port: number; username: string },
                                Record<string, never>
                              > :
                                T extends 'ssh.connection.didDisconnect' ? IHookContract<
                                  { hostId: string; reason?: string },
                                  Record<string, never>
                                > :
                                  T extends 'app.ready' ? IHookContract<
                                    Record<string, never>,
                                    Record<string, never>
                                  > :
                                    T extends 'app.willQuit' ? IHookContract<
                                      Record<string, never>,
                                      { cancel?: boolean }
                                    > :
                                      IHookContract<unknown, Record<string, unknown>>;

export type HookInputOf<T extends ExtensionHookName> = HookContractOf<T>['input'];
export type HookOutputOf<T extends ExtensionHookName> = HookContractOf<T>['output'];
