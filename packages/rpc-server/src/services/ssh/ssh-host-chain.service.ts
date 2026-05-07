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

import type { IDisposable, Nullable } from '@termlnk/core';
import type { SSHHopProgressStatus, SSHSessionEvent } from '@termlnk/rpc';
import type { IHost } from '@termlnk/terminal';
import type { Duplex } from 'node:stream';
import type { ChangePasswordCallback, KeyboardInteractiveCallback } from 'ssh2';
import type { ISSHSocket } from './ssh-socket';
import { createIdentifier, Disposable, DisposableCollection, ILogService, Inject, toDisposable } from '@termlnk/core';
import { HostRepository } from '@termlnk/database';
import { SSHSocketStatus } from '@termlnk/rpc';
import { firstValueFrom, mergeMap, race, Subject, throwError, timer } from 'rxjs';
import { ISSHSocketService } from './ssh-socket.service';

export interface IHostChainHopEvent {
  hopId: string;
  hopLabel: string;
  event: SSHSessionEvent;
}

export interface IHostChainProgressEvent {
  hopId: string;
  hopLabel: string;
  hopIndex: number;
  hopCount: number;
  status: SSHHopProgressStatus;
  message?: string;
}

/**
 * Synchronously-constructable handle for an in-flight host chain build.
 *
 * `hops`/`hopEvent$`/`progress$` are populated immediately so callers can
 * subscribe before any progress events fire. The async build is driven
 * internally; `ready` resolves with the final TCP tunnel (used as the target
 * host's ConnectConfig.sock) or rejects on the first failing hop.
 *
 * `dispose()` is idempotent and must be called once the consumer no longer
 * needs the chain — it releases every hop's socket refcount.
 */
export interface IHostChainHandle extends IDisposable {
  readonly hops: ReadonlyArray<{ hostId: string; hopLabel: string }>;
  readonly hopEvent$: Subject<IHostChainHopEvent>;
  readonly progress$: Subject<IHostChainProgressEvent>;
  readonly ready: Promise<Duplex>;
  respondKeyboardInteractive(hopId: string, responses: string[]): void;
  respondChangePassword(hopId: string, newPassword: string): void;
}

export interface ISSHHostChainService {
  /**
   * Resolve `host.hostChainIds` into hop runtimes and start building the chain.
   * Returns a handle whose subjects are immediately subscribable, and whose
   * `ready` promise resolves with the Duplex stream to inject into the target
   * host's ConnectConfig.sock. Returns null when the host has no chain
   * configured.
   */
  startTunnel(host: IHost): Promise<IHostChainHandle | null>;
}

export const ISSHHostChainService = createIdentifier<ISSHHostChainService>('rpc-server.ssh-host-chain-service');

interface IHopRuntime {
  host: IHost;
  hopLabel: string;
  hopIndex: number;
  hopCount: number;
  socket: ISSHSocket;
  multiplexerKey: string;
  disposables: DisposableCollection;
  pendingKeyboardInteractive: KeyboardInteractiveCallback | null;
  pendingChangePassword: ChangePasswordCallback | null;
}

export class SSHHostChainService extends Disposable implements ISSHHostChainService {
  constructor(
    @ISSHSocketService private readonly _sshSocketService: ISSHSocketService,
    @Inject(HostRepository) private readonly _hostRepository: HostRepository,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  async startTunnel(host: IHost): Promise<IHostChainHandle | null> {
    const chain = await this._hostRepository.resolveHostChain(host);
    if (chain.length === 0) {
      return null;
    }

    const hops: ReadonlyArray<{ hostId: string; hopLabel: string }> = chain.map((h) => ({
      hostId: h.id,
      hopLabel: h.label,
    }));
    const hopEvent$ = new Subject<IHostChainHopEvent>();
    const progress$ = new Subject<IHostChainProgressEvent>();
    const runtimes: IHopRuntime[] = [];
    let disposed = false;

    const respondKeyboardInteractive = (hopId: string, responses: string[]): void => {
      const runtime = runtimes.find((r) => r.host.id === hopId);
      runtime?.pendingKeyboardInteractive?.(responses);
      if (runtime) {
        runtime.pendingKeyboardInteractive = null;
      }
    };

    const respondChangePassword = (hopId: string, newPassword: string): void => {
      const runtime = runtimes.find((r) => r.host.id === hopId);
      runtime?.pendingChangePassword?.(newPassword);
      if (runtime) {
        runtime.pendingChangePassword = null;
      }
    };

    const dispose = (): void => {
      if (disposed) {
        return;
      }
      disposed = true;
      for (const runtime of runtimes) {
        runtime.disposables.dispose();
        this._sshSocketService.releaseSocket(runtime.multiplexerKey);
      }
      runtimes.length = 0;
      hopEvent$.complete();
      progress$.complete();
    };

    const ready = this._driveBuild(host, chain, runtimes, hopEvent$, progress$, () => disposed)
      .catch((err) => {
        // Build failure: release acquired sockets immediately to avoid leaks,
        // but keep subjects open until dispose() so subscribers can still
        // observe the terminal `failed` progress event we already emitted.
        for (const runtime of runtimes) {
          runtime.disposables.dispose();
          this._sshSocketService.releaseSocket(runtime.multiplexerKey);
        }
        runtimes.length = 0;
        throw err;
      });

    return {
      hops,
      hopEvent$,
      progress$,
      ready,
      respondKeyboardInteractive,
      respondChangePassword,
      dispose,
    };
  }

  private async _driveBuild(
    target: IHost,
    chain: IHost[],
    runtimes: IHopRuntime[],
    hopEvent$: Subject<IHostChainHopEvent>,
    progress$: Subject<IHostChainProgressEvent>,
    isDisposed: () => boolean
  ): Promise<Duplex> {
    const hopCount = chain.length;
    let prevSock: Nullable<Duplex> = null;

    for (let i = 0; i < chain.length; i++) {
      if (isDisposed()) {
        throw new Error('Host chain build aborted');
      }

      const hopHost = chain[i];
      const nextHost = chain[i + 1] ?? target;
      const multiplexerKey = this._sshSocketService.getMultiplexerKey(hopHost);
      const socket = this._sshSocketService.createSocket(multiplexerKey);

      const runtime: IHopRuntime = {
        host: hopHost,
        hopLabel: hopHost.label,
        hopIndex: i,
        hopCount,
        socket,
        multiplexerKey,
        disposables: new DisposableCollection(),
        pendingKeyboardInteractive: null,
        pendingChangePassword: null,
      };
      runtimes.push(runtime);

      this._wireHopEvents(runtime, hopEvent$);

      progress$.next({
        hopId: hopHost.id,
        hopLabel: hopHost.label,
        hopIndex: i,
        hopCount,
        status: 'connecting',
      });

      try {
        if (socket.status === SSHSocketStatus.IDLE) {
          const config = await this._sshSocketService.createConnectConfig(
            hopHost,
            prevSock ? { chainTunnel: prevSock } : undefined
          );
          socket.connect(config);
        }

        progress$.next({
          hopId: hopHost.id,
          hopLabel: hopHost.label,
          hopIndex: i,
          hopCount,
          status: 'authenticating',
        });

        await this._waitForReady(runtime);

        progress$.next({
          hopId: hopHost.id,
          hopLabel: hopHost.label,
          hopIndex: i,
          hopCount,
          status: 'ready',
        });

        prevSock = await runtime.socket.forwardOut('127.0.0.1', 0, nextHost.addr, nextHost.port);
      } catch (err) {
        progress$.next({
          hopId: hopHost.id,
          hopLabel: hopHost.label,
          hopIndex: i,
          hopCount,
          status: 'failed',
          message: err instanceof Error ? err.message : String(err),
        });
        this._logService.error('[SSHHostChainService] hop failed', { hopId: hopHost.id, hopLabel: hopHost.label }, err);
        throw err instanceof Error ? err : new Error(String(err));
      }
    }

    if (!prevSock) {
      // Unreachable: chain.length === 0 already short-circuited in startTunnel.
      throw new Error('Host chain produced no terminal channel');
    }

    return prevSock;
  }

  private _wireHopEvents(runtime: IHopRuntime, sink: Subject<IHostChainHopEvent>): void {
    const { host, hopLabel, socket, disposables } = runtime;
    const viaHopId = host.id;
    const viaHopLabel = hopLabel;

    disposables.add(toDisposable(socket.keyboardInteractive$.subscribe(({ name, instructions, prompts, finish }) => {
      runtime.pendingKeyboardInteractive = finish;
      sink.next({
        hopId: host.id,
        hopLabel,
        event: {
          type: 'keyboard_interactive',
          name,
          instructions,
          prompts: prompts.map((p) => ({ prompt: p.prompt, echo: p.echo ?? false })),
          viaHopId,
          viaHopLabel,
        },
      });
    })));

    disposables.add(toDisposable(socket.changePassword$.subscribe(({ message, done }) => {
      runtime.pendingChangePassword = done;
      sink.next({
        hopId: host.id,
        hopLabel,
        event: { type: 'change_password', message, viaHopId, viaHopLabel },
      });
    })));

    disposables.add(toDisposable(socket.banner$.subscribe((message) => {
      sink.next({
        hopId: host.id,
        hopLabel,
        event: { type: 'banner', message, viaHopId, viaHopLabel },
      });
    })));

    disposables.add(toDisposable(socket.error$.subscribe(({ err }) => {
      const isAuthError = (err as { level?: string })?.level === 'client-authentication';
      if (!isAuthError) {
        return;
      }
      sink.next({
        hopId: host.id,
        hopLabel,
        event: { type: 'auth_failed', message: err.message, viaHopId, viaHopLabel },
      });
    })));
  }

  private async _waitForReady(runtime: IHopRuntime): Promise<void> {
    const { socket, host } = runtime;
    if (socket.status === SSHSocketStatus.READY) {
      return;
    }
    const timeoutMs = host.settings?.connectTimeout || 30000;
    await firstValueFrom(
      race(
        socket.ready$,
        socket.error$.pipe(mergeMap(({ err }) => throwError(() => err))),
        socket.close$.pipe(mergeMap(() => throwError(() => new Error(`Hop ${host.label} closed before ready`)))),
        timer(timeoutMs).pipe(mergeMap(() => throwError(() => new Error(`Hop ${host.label} timed out after ${timeoutMs}ms`))))
      )
    );
  }
}
