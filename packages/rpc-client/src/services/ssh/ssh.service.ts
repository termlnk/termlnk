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

import type { ITerminalSessionClosedEvent, ITerminalSessionCreatedEvent, SSHSessionEvent, SSHSessionStatus } from '@termlnk/rpc';
import type { ITerminalOutputChunk } from '@termlnk/terminal';
import type { Observable } from 'rxjs';
import { createIdentifier, Disposable } from '@termlnk/core';
import { trpcSubscriptionToObservable } from '@termlnk/rpc';
import { ITerminalOutputTransportService } from '@termlnk/terminal';
import { IRPCClientService } from '../rpc-client.service';

export interface ISSHTestConnectionInput {
  addr: string;
  port: number;
  credential: { type: 'password'; username: string; password: string } | { type: 'rsa'; username: string; privateKey: string };
  proxy?: { enabled: boolean; type: 'socks5' | 'http'; host: string; port: number; username?: string; password?: string };
  settings?: { connectTimeout?: number };
  hostChainIds?: string[];
}

export interface ISSHTestConnectionResult {
  ok: boolean;
  latency: number;
  message?: string;
}

export interface ISSHService {
  sessionCreated$: Observable<ITerminalSessionCreatedEvent>;
  sessionClosed$: Observable<ITerminalSessionClosedEvent>;

  createSession(hostId: string, cols?: number, rows?: number, password?: string, sessionId?: string): Promise<string>;
  closeSession(sessionId: string): Promise<void>;
  retrySession(sessionId: string, password: string): Promise<void>;
  resize(sessionId: string, rows: number, cols: number): Promise<void>;
  write(sessionId: string, data: string): Promise<void>;
  data$(sessionId: string): Observable<ITerminalOutputChunk>;
  status$(sessionId: string): Observable<SSHSessionStatus>;
  event$(sessionId: string): Observable<SSHSessionEvent>;
  error$(sessionId: string): Observable<string>;
  respondKeyboardInteractive(sessionId: string, responses: string[], viaHopId?: string): Promise<void>;
  respondChangePassword(sessionId: string, newPassword: string, viaHopId?: string): Promise<void>;
  respondHostKeyVerify(sessionId: string, action: 'accept_save' | 'accept_once' | 'reject'): Promise<void>;
  testConnection(input: ISSHTestConnectionInput): Promise<ISSHTestConnectionResult>;
  setFocusedSession(sessionId: string | null): Promise<void>;
}
export const ISSHService = createIdentifier<ISSHService>('rpc-client.ssh-service');

export class SSHService extends Disposable implements ISSHService {
  constructor(
    @IRPCClientService private readonly _rpcClientService: IRPCClientService,
    @ITerminalOutputTransportService private readonly _terminalOutputTransportService: ITerminalOutputTransportService
  ) {
    super();
  }

  private get _client() {
    return this._rpcClientService.getClient().ssh;
  }

  async createSession(hostId: string, cols = 80, rows = 24, password?: string, sessionId?: string): Promise<string> {
    return this._client.createSession.mutate({ hostId, cols, rows, password, sessionId });
  }

  async closeSession(sessionId: string): Promise<void> {
    await this._client.closeSession.mutate(sessionId);
  }

  async retrySession(sessionId: string, password: string): Promise<void> {
    await this._client.retrySession.mutate({ sessionId, password });
  }

  async resize(sessionId: string, rows: number, cols: number): Promise<void> {
    await this._client.resize.mutate({ sessionId, rows, cols });
  }

  async write(sessionId: string, data: string): Promise<void> {
    await this._client.write.mutate({ sessionId, data });
  }

  data$(sessionId: string): Observable<ITerminalOutputChunk> {
    return this._terminalOutputTransportService.data$('ssh', sessionId);
  }

  status$(sessionId: string): Observable<SSHSessionStatus> {
    return trpcSubscriptionToObservable((opts) =>
      this._client.status$.subscribe(sessionId, opts)
    );
  }

  event$(sessionId: string): Observable<SSHSessionEvent> {
    return trpcSubscriptionToObservable((opts) =>
      this._client.event$.subscribe(sessionId, opts)
    );
  }

  error$(sessionId: string): Observable<string> {
    return trpcSubscriptionToObservable((opts) =>
      this._client.error$.subscribe(sessionId, opts)
    );
  }

  async respondKeyboardInteractive(sessionId: string, responses: string[], viaHopId?: string): Promise<void> {
    await this._client.respondKeyboardInteractive.mutate({ sessionId, responses, viaHopId });
  }

  async respondChangePassword(sessionId: string, newPassword: string, viaHopId?: string): Promise<void> {
    await this._client.respondChangePassword.mutate({ sessionId, newPassword, viaHopId });
  }

  async respondHostKeyVerify(sessionId: string, action: 'accept_save' | 'accept_once' | 'reject'): Promise<void> {
    await this._client.respondHostKeyVerify.mutate({ sessionId, action });
  }

  async testConnection(input: ISSHTestConnectionInput): Promise<ISSHTestConnectionResult> {
    return this._client.testConnection.mutate(input);
  }

  async setFocusedSession(sessionId: string | null): Promise<void> {
    await this._client.setFocusedSession.mutate(sessionId);
  }

  readonly sessionCreated$: Observable<ITerminalSessionCreatedEvent> = trpcSubscriptionToObservable(
    (opts) => this._client.sessionCreated$.subscribe(undefined, opts)
  );

  readonly sessionClosed$: Observable<ITerminalSessionClosedEvent> = trpcSubscriptionToObservable(
    (opts) => this._client.sessionClosed$.subscribe(undefined, opts)
  );
}
