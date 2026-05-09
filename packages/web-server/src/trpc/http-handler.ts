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
   * URL 路径前缀。`/trpc` 会被识别成 `/trpc/{procedurePath}`——
   * tRPC 内部要求 basePath 末尾含斜杠，本函数自动补斜杠。
   */
  readonly basePath: string;
}

/**
 * 把 @termlnk/rpc-server 的 appRouter 适配到 Node http RequestListener。
 *
 * 与 desktop 端 `packages/electron-main/src/controllers/rpc.controller.ts` 中
 * `createIPCHandler` 是平行物——transport 不同（HTTP vs Electron IPC），
 * 两者构造的 IRPCContext 都包含 injector。
 *
 * P7.1a 暂不附 windowId / sessionId（只服务 query / mutation 不需要广播路由）；
 * P7.1c 引入 session cookie 后会在这里读 cookie 并把解析出的 sessionId 注入 context。
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
