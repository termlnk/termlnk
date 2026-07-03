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
import type { ITerminalMiddleware } from './terminal-middleware';

export interface ITerminalMiddlewareStack extends IDisposable {
  unshift(middleware: ITerminalMiddleware): void;
  push(middleware: ITerminalMiddleware): void;
  remove(name: string): void;
  processFromSession(data: Uint8Array): Uint8Array | null;
  processFromTerminal(data: Uint8Array): Uint8Array | null;
  readonly hasActiveMiddleware: boolean;
}

export function createTerminalMiddlewareStack(): ITerminalMiddlewareStack {
  const _middlewares: ITerminalMiddleware[] = [];

  return {
    unshift(middleware: ITerminalMiddleware): void {
      _middlewares.unshift(middleware);
    },

    push(middleware: ITerminalMiddleware): void {
      _middlewares.push(middleware);
    },

    remove(name: string): void {
      const index = _middlewares.findIndex((m) => m.name === name);
      if (index !== -1) {
        _middlewares[index].dispose();
        _middlewares.splice(index, 1);
      }
    },

    processFromSession(data: Uint8Array): Uint8Array | null {
      let current: Uint8Array | null = data;
      for (const middleware of _middlewares) {
        if (current === null) {
          break;
        }
        current = middleware.feedFromSession(current);
      }
      return current;
    },

    processFromTerminal(data: Uint8Array): Uint8Array | null {
      let current: Uint8Array | null = data;
      for (const middleware of _middlewares) {
        if (current === null) {
          break;
        }
        current = middleware.feedFromTerminal(current);
      }
      return current;
    },

    get hasActiveMiddleware(): boolean {
      return _middlewares.some((m) => m.state === 'active');
    },

    dispose(): void {
      for (const middleware of _middlewares) {
        middleware.dispose();
      }
      _middlewares.length = 0;
    },
  };
}
