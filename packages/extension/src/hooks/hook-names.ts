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
 * Well-known hook identifiers emitted by host business code and observable to
 * extensions via `ctx.events.on(hookName, ...)`.
 *
 * Extensions relying on a hook that the host never fires will simply never
 * receive events — there is no runtime check that a name is "valid". The
 * strong typing here is for compile-time ergonomics so IDE completion and
 * input/output type inference work out of the box.
 *
 * When adding a new hook:
 *   1. Add it to this union.
 *   2. Extend `HookContractOf<T>` in `hook-contracts.ts` with its I/O shape.
 *   3. Find the nearest business call site and call `invokeHook(...)` there.
 */
export type ExtensionHookName =
  // chat / agent lifecycle
  | 'chat.message.willSend'
  | 'chat.message.didSend'
  | 'chat.message.didReceive'
  | 'chat.thread.created'
  | 'chat.thread.activated'
  | 'chat.thread.deleted'
  // tool lifecycle
  | 'tool.willExecute'
  | 'tool.didExecute'
  | 'tool.onError'
  // terminal lifecycle
  | 'terminal.session.willOpen'
  | 'terminal.session.didOpen'
  | 'terminal.session.didClose'
  | 'terminal.output.didReceive'
  // ssh lifecycle
  | 'ssh.connection.willEstablish'
  | 'ssh.connection.didEstablish'
  | 'ssh.connection.didDisconnect'
  // app lifecycle
  | 'app.ready'
  | 'app.willQuit';
