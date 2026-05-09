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

import type { Injector } from '@termlnk/core';
import type { IRPCContext } from '@termlnk/rpc';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AnyRouter } from './types';
import { createHTTPHandler } from '@trpc/server/adapters/standalone';

export interface ICreateTRPCStandaloneHandlerOptions {
  readonly router: AnyRouter;
  readonly injector: Injector;
  /**
   * URL prefix. `/trpc` resolves to `/trpc/{procedurePath}`. tRPC requires the
   * basePath to end with a slash; this helper adds one when missing.
   */
  readonly basePath: string;
}

/**
 * Adapt the `@termlnk/rpc-server` appRouter to a Node http RequestListener.
 *
 * Sibling of `createIPCHandler` in `packages/electron-main/src/controllers/rpc.controller.ts`:
 * the transport differs (HTTP vs Electron IPC), but both produce an IRPCContext
 * carrying the same injector.
 *
 * For now no windowId / sessionId is attached — pure query/mutation does not
 * need a per-connection identity. P7.1c will extend the createContext callback
 * to read the session cookie and inject sessionId here.
 */
export function createTRPCStandaloneHandler(opts: ICreateTRPCStandaloneHandlerOptions): (req: IncomingMessage, res: ServerResponse) => void {
  const basePath = opts.basePath.endsWith('/') ? opts.basePath : `${opts.basePath}/`;

  return createHTTPHandler({
    router: opts.router,
    basePath,
    createContext: async (): Promise<IRPCContext> => {
      return {
        injector: opts.injector,
      };
    },
  });
}
