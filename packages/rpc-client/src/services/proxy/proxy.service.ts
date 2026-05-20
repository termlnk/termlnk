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

import type { IProxy } from '@termlnk/terminal';
import { createIdentifier, Disposable } from '@termlnk/core';
import { IRPCClientService } from '../rpc-client.service';

export interface IProxyTestInput extends IProxy {
  timeout?: number;
}

export interface IProxyTestResult {
  ok: boolean;
  latency: number;
  ip?: string;
  message?: string;
}

export interface IProxyService {
  testProxy(input: IProxyTestInput): Promise<IProxyTestResult>;
}

export const IProxyService = createIdentifier<IProxyService>('rpc-client.proxy-service');

export class ProxyClientService extends Disposable implements IProxyService {
  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();
  }

  get client() {
    return this._rpcClientService.getClient().proxy;
  }

  async testProxy(input: IProxyTestInput): Promise<IProxyTestResult> {
    return this.client.test.mutate(input);
  }
}
