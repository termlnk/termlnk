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

import type { ILocalTerminalShellOption, IPTYCreateSessionOptions, IPTYService, PTYSessionStatus } from '@termlnk/terminal';
import type { Observable } from 'rxjs';
import { Disposable } from '@termlnk/core';
import { decodeBase64Utf8Stream, trpcSubscriptionToObservable } from '@termlnk/rpc';
import { IRPCClientService } from '../rpc-client.service';

export class PTYService extends Disposable implements IPTYService {
  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService
  ) {
    super();
  }

  private get _client() {
    return (this._rpcClientService.getClient() as any).pty;
  }

  async createSession(options?: IPTYCreateSessionOptions): Promise<string> {
    return this._client.createSession.mutate(options ?? {});
  }

  async closeSession(sessionId: string): Promise<void> {
    await this._client.closeSession.mutate(sessionId);
  }

  async resize(sessionId: string, rows: number, cols: number): Promise<void> {
    await this._client.resize.mutate({ sessionId, rows, cols });
  }

  async write(sessionId: string, data: string): Promise<void> {
    await this._client.write.mutate({ sessionId, data });
  }

  data$(sessionId: string): Observable<string> {
    return decodeBase64Utf8Stream(
      trpcSubscriptionToObservable<string>((opts) =>
        this._client.data$.subscribe(sessionId, opts)
      )
    );
  }

  status$(sessionId: string): Observable<PTYSessionStatus> {
    return trpcSubscriptionToObservable((opts) =>
      this._client.status$.subscribe(sessionId, opts)
    );
  }

  async getShellPath(sessionId: string): Promise<string> {
    return this._client.getShellPath.query(sessionId);
  }

  async getCurrentCwd(sessionId: string): Promise<string> {
    return this._client.getCurrentCwd.query(sessionId);
  }

  async getLocalTerminalShellOptions(): Promise<ILocalTerminalShellOption[]> {
    return this._client.getLocalTerminalShellOptions.query();
  }
}
