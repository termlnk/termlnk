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

import type { DesktopAppRouter } from '@termlnk/electron-main';
import type { IRPCClientService } from '@termlnk/rpc-client';
import type { TRPCClient } from '@trpc/client';
import { ipcLink } from '@janwirth/electron-trpc-link/renderer';
import { Disposable } from '@termlnk/core';
import { createTRPCClient } from '@trpc/client';

export class RPCClientService extends Disposable implements IRPCClientService {
  private _client: TRPCClient<DesktopAppRouter>;

  constructor() {
    super();

    this._init();
  }

  private _init() {
    this._client = createTRPCClient<DesktopAppRouter>({
      links: [ipcLink()],
    });
  }

  getClient() {
    return this._client as any;
  }
}
