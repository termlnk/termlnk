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

import type { ILogService, Nullable } from '@termlnk/core';
import type { ConfigRepository, HostRepository } from '@termlnk/database';
import type { IPortForwardingRule, IPortForwardingRuntimeState, PortForwardingAuthEvent, PortForwardingHostKeyAction } from '@termlnk/rpc';
import type { IHost } from '@termlnk/terminal';
import type { Observable } from 'rxjs';
import type { ChangePasswordCallback, KeyboardInteractiveCallback } from 'ssh2';
import type { IHostChainHandle, ISSHHostChainService } from '../ssh/ssh-host-chain.service';
import type { ISSHSocket } from '../ssh/ssh-socket';
import type { HostKeyVerifyAction, IHostKeyPromptInfo, ISSHSocketService } from '../ssh/ssh-socket.service';
import { DisposableCollection, RxDisposable, toDisposable } from '@termlnk/core';
import { PortForwardingTunnelStatus, SSHSocketStatus } from '@termlnk/rpc';
import { BehaviorSubject, Subject, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { resolveHostWithProxy } from '../proxy/resolve-effective-proxy';
import { TrafficMeter } from './traffic-meter';

export interface IPortForwardingTunnelDeps {
  rule: IPortForwardingRule;
  hostRepository: HostRepository;
  configRepository: ConfigRepository;
  sshSocketService: ISSHSocketService;
  sshHostChainService: ISSHHostChainService;
  logService: ILogService;
}

export interface IPortForwardingTunnel {
  readonly ruleId: string;
  readonly state$: Observable<IPortForwardingRuntimeState>;
  readonly authEvent$: Observable<PortForwardingAuthEvent>;
  getState(): IPortForwardingRuntimeState;

  start(options?: { password?: string }): Promise<void>;
  stop(): Promise<void>;
  respondKeyboardInteractive(responses: string[]): void;
  respondChangePassword(newPassword: string): void;
  respondHostKeyPrompt(action: PortForwardingHostKeyAction): void;

  dispose(): void;
}

/**
 * Skeleton tunnel: resolves host → optional host chain → SSH socket reference
 * → ready event, then hands off to the subclass via `_attachToSocket()`.
 *
 * Subclasses must implement `_attachToSocket` (set up listener / forwardIn)
 * and `_detachFromSocket` (tear down). The base owns ref-count discipline,
 * traffic metering, status$, and auth event transcoding.
 */
export abstract class BasePortForwardingTunnel extends RxDisposable implements IPortForwardingTunnel {
  protected readonly _state$ = new BehaviorSubject<IPortForwardingRuntimeState>({
    ruleId: '',
    status: PortForwardingTunnelStatus.IDLE,
    activeConnections: 0,
    totalConnections: 0,
    bytesIn: 0,
    bytesOut: 0,
    bytesInRate: 0,
    bytesOutRate: 0,
  });

  readonly state$: Observable<IPortForwardingRuntimeState> = this._state$.asObservable();

  protected readonly _authEvent$ = new Subject<PortForwardingAuthEvent>();
  readonly authEvent$: Observable<PortForwardingAuthEvent> = this._authEvent$.asObservable();

  protected _socket: Nullable<ISSHSocket> = null;
  protected _socketKey: Nullable<string> = null;
  protected _chainHandle: Nullable<IHostChainHandle> = null;
  protected _resolvedHost: Nullable<IHost> = null;
  protected _password: Nullable<string> = null;
  protected _effectiveBindPort: Nullable<number> = null;
  protected _activeConnections = 0;
  protected _totalConnections = 0;
  protected _meter: Nullable<TrafficMeter> = null;
  protected _pendingKeyboardInteractive: Nullable<KeyboardInteractiveCallback> = null;
  protected _pendingChangePassword: Nullable<ChangePasswordCallback> = null;
  protected _pendingHostKey: Nullable<(action: HostKeyVerifyAction) => void> = null;
  protected _socketSubscriptions = new DisposableCollection();

  protected readonly _rule: IPortForwardingRule;
  protected readonly _hostRepository: HostRepository;
  protected readonly _configRepository: ConfigRepository;
  protected readonly _sshSocketService: ISSHSocketService;
  protected readonly _sshHostChainService: ISSHHostChainService;
  protected readonly _logService: ILogService;

  constructor(deps: IPortForwardingTunnelDeps) {
    super();
    this._rule = deps.rule;
    this._hostRepository = deps.hostRepository;
    this._configRepository = deps.configRepository;
    this._sshSocketService = deps.sshSocketService;
    this._sshHostChainService = deps.sshHostChainService;
    this._logService = deps.logService;
    this._state$.next({ ...this._state$.getValue(), ruleId: this._rule.id });
  }

  override dispose(): void {
    // Tear down the socket / chain / listener asynchronously, but defer
    // completing the subjects until that finishes so concurrent _updateState
    // calls don't race the completion. super.dispose() runs immediately so
    // dispose$ stops the meter timer and removes us from the parent collection.
    const teardown = this._teardown()
      .catch((err) => this._logService.warn(`[PortForwarding ${this._rule.id}] dispose teardown failed`, err));
    super.dispose();
    void teardown.finally(() => {
      this._state$.complete();
      this._authEvent$.complete();
    });
  }

  get ruleId(): string {
    return this._rule.id;
  }

  getState(): IPortForwardingRuntimeState {
    return this._state$.getValue();
  }

  async start(options?: { password?: string }): Promise<void> {
    if (this._socket) {
      throw new Error(`Tunnel ${this._rule.id} already started`);
    }
    this._password = options?.password ?? null;
    this._updateState({ status: PortForwardingTunnelStatus.STARTING, error: undefined });

    try {
      const host = await this._hostRepository.getInfoById(this._rule.hostId);
      if (!host) {
        throw new Error(`Host ${this._rule.hostId} not found for rule ${this._rule.id}`);
      }
      if (host.type !== 'host') {
        throw new Error(`Host ${this._rule.hostId} is not a connectable host`);
      }
      const resolved = await resolveHostWithProxy(host as IHost, this._configRepository);
      this._resolvedHost = resolved;

      const chainHandle = await this._sshHostChainService.startTunnel(resolved);
      this._chainHandle = chainHandle;
      if (chainHandle) {
        this._wireChainEvents(chainHandle);
      }

      const key = this._sshSocketService.getMultiplexerKey(resolved);
      this._socketKey = key;
      const socket = this._sshSocketService.createSocket(key);
      this._socket = socket;

      this._wireSocketEvents(socket);

      this._updateState({ status: PortForwardingTunnelStatus.AUTHENTICATING });

      if (chainHandle) {
        const finalSock = await chainHandle.ready;
        if (socket.status === SSHSocketStatus.IDLE) {
          const config = await this._sshSocketService.createConnectConfig(resolved, {
            password: this._password ?? undefined,
            chainTunnel: finalSock,
            onHostKeyPrompt: (info) => this._handleHostKeyPrompt(info),
          });
          socket.connect(config);
        }
      } else if (socket.status === SSHSocketStatus.IDLE) {
        const config = await this._sshSocketService.createConnectConfig(resolved, {
          password: this._password ?? undefined,
          onHostKeyPrompt: (info) => this._handleHostKeyPrompt(info),
        });
        socket.connect(config);
      }

      await this._waitForReady(socket);

      this._meter = new TrafficMeter(Date.now());
      await this._attachToSocket(socket);

      this._startMeterTicks();

      this._updateState({
        status: PortForwardingTunnelStatus.ACTIVE,
        startedAt: Date.now(),
        effectiveBindPort: this._effectiveBindPort ?? this._rule.bindPort,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this._logService.error(`[PortForwarding ${this._rule.id}] start failed`, err);
      await this._teardown();
      this._updateState({ status: PortForwardingTunnelStatus.FAILED, error });
      throw err instanceof Error ? err : new Error(error);
    }
  }

  async stop(): Promise<void> {
    if (this.getState().status === PortForwardingTunnelStatus.CLOSED) {
      return;
    }
    if (!this._socket && !this._chainHandle && !this._socketKey) {
      this._updateState({ status: PortForwardingTunnelStatus.CLOSED });
      return;
    }
    this._updateState({ status: PortForwardingTunnelStatus.STOPPING });
    await this._teardown();
    this._updateState({ status: PortForwardingTunnelStatus.CLOSED });
  }

  respondKeyboardInteractive(responses: string[]): void {
    const cb = this._pendingKeyboardInteractive;
    this._pendingKeyboardInteractive = null;
    cb?.(responses);
  }

  respondChangePassword(newPassword: string): void {
    const cb = this._pendingChangePassword;
    this._pendingChangePassword = null;
    cb?.(newPassword);
  }

  respondHostKeyPrompt(action: PortForwardingHostKeyAction): void {
    const cb = this._pendingHostKey;
    this._pendingHostKey = null;
    cb?.(action);
  }

  // --- Subclass hooks ---

  protected abstract _attachToSocket(socket: ISSHSocket): Promise<void>;
  protected abstract _detachFromSocket(socket: ISSHSocket): Promise<void>;

  // --- Active-connection tracking helpers for subclasses ---

  protected _incActive(): void {
    this._activeConnections++;
    this._totalConnections++;
    this._publishCounters();
  }

  protected _decActive(): void {
    this._activeConnections = Math.max(0, this._activeConnections - 1);
    this._publishCounters();
  }

  private _publishCounters(): void {
    this._updateState({
      activeConnections: this._activeConnections,
      totalConnections: this._totalConnections,
    });
  }

  // --- Internals ---

  private _updateState(patch: Partial<IPortForwardingRuntimeState>): void {
    this._state$.next({ ...this._state$.getValue(), ...patch });
  }

  private _startMeterTicks(): void {
    // 250ms tick — meter snapshot + status combined into a single IPC frame.
    timer(0, 250).pipe(takeUntil(this.dispose$)).subscribe(() => {
      if (!this._meter) {
        return;
      }
      const snapshot = this._meter.snapshot(Date.now());
      this._updateState(snapshot);
    });
  }

  private _wireChainEvents(handle: IHostChainHandle): void {
    handle.hopEvent$.pipe(takeUntil(this.dispose$)).subscribe(({ event, hopId, hopLabel }) => {
      switch (event.type) {
        case 'keyboard_interactive':
          this._authEvent$.next({
            ruleId: this._rule.id,
            type: 'keyboard_interactive',
            name: event.name,
            instructions: event.instructions,
            prompts: event.prompts,
            viaHopId: hopId,
            viaHopLabel: hopLabel,
          });
          this._pendingKeyboardInteractive = (responses: string[]) => {
            handle.respondKeyboardInteractive(hopId, responses);
          };
          break;
        case 'change_password':
          this._authEvent$.next({
            ruleId: this._rule.id,
            type: 'change_password',
            message: event.message,
            viaHopId: hopId,
            viaHopLabel: hopLabel,
          });
          this._pendingChangePassword = (newPassword: string) => {
            handle.respondChangePassword(hopId, newPassword);
          };
          break;
        case 'auth_failed':
          this._authEvent$.next({
            ruleId: this._rule.id,
            type: 'auth_failed',
            message: event.message,
            viaHopId: hopId,
            viaHopLabel: hopLabel,
          });
          break;
        case 'banner':
          this._authEvent$.next({
            ruleId: this._rule.id,
            type: 'banner',
            message: event.message,
            viaHopId: hopId,
            viaHopLabel: hopLabel,
          });
          break;
      }
    });
  }

  private _wireSocketEvents(socket: ISSHSocket): void {
    this._socketSubscriptions.add(toDisposable(
      socket.keyboardInteractive$.subscribe(({ name, instructions, prompts, finish }) => {
        this._pendingKeyboardInteractive = finish;
        this._authEvent$.next({
          ruleId: this._rule.id,
          type: 'keyboard_interactive',
          name,
          instructions,
          prompts: prompts.map((p) => ({ prompt: p.prompt, echo: p.echo ?? false })),
        });
      })
    ));
    this._socketSubscriptions.add(toDisposable(
      socket.changePassword$.subscribe(({ message, done }) => {
        this._pendingChangePassword = done;
        this._authEvent$.next({ ruleId: this._rule.id, type: 'change_password', message });
      })
    ));
    this._socketSubscriptions.add(toDisposable(
      socket.banner$.subscribe((message) => {
        this._authEvent$.next({ ruleId: this._rule.id, type: 'banner', message });
      })
    ));
    this._socketSubscriptions.add(toDisposable(
      socket.error$.subscribe(({ err }) => {
        const level = (err as { level?: string }).level;
        if (level === 'client-authentication') {
          this._authEvent$.next({ ruleId: this._rule.id, type: 'auth_failed', message: err.message });
        }
      })
    ));
    this._socketSubscriptions.add(toDisposable(
      socket.close$.subscribe(() => {
        if (this.getState().status === PortForwardingTunnelStatus.ACTIVE) {
          this._updateState({
            status: PortForwardingTunnelStatus.FAILED,
            error: 'SSH connection closed',
          });
        }
      })
    ));
  }

  private _handleHostKeyPrompt(info: IHostKeyPromptInfo): Promise<HostKeyVerifyAction> {
    return new Promise((resolve) => {
      this._pendingHostKey = resolve;
      this._authEvent$.next({
        ruleId: this._rule.id,
        type: 'host_key_prompt',
        algorithm: info.algorithm,
        fingerprint: info.fingerprint,
        changed: info.changed,
        knownFingerprint: info.knownFingerprint,
      });
    });
  }

  private async _waitForReady(socket: ISSHSocket): Promise<void> {
    if (socket.status === SSHSocketStatus.READY) {
      return;
    }
    const timeoutMs = this._resolvedHost?.settings?.connectTimeout || 30000;
    await new Promise<void>((resolve, reject) => {
      const subs = new DisposableCollection();
      const timer = setTimeout(() => {
        subs.dispose();
        reject(new Error(`Tunnel ${this._rule.id} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      subs.add(toDisposable(socket.ready$.subscribe(() => {
        clearTimeout(timer);
        subs.dispose();
        resolve();
      })));
      subs.add(toDisposable(socket.error$.subscribe(({ err }) => {
        clearTimeout(timer);
        subs.dispose();
        reject(err);
      })));
      subs.add(toDisposable(socket.close$.subscribe(() => {
        clearTimeout(timer);
        subs.dispose();
        reject(new Error(`SSH connection closed before tunnel ${this._rule.id} became ready`));
      })));
    });
  }

  private async _teardown(): Promise<void> {
    const socket = this._socket;
    if (socket) {
      try {
        await this._detachFromSocket(socket);
      } catch (err) {
        this._logService.warn(`[PortForwarding ${this._rule.id}] detach error`, err);
      }
    }
    this._socketSubscriptions.dispose();
    this._socketSubscriptions = new DisposableCollection();
    this._chainHandle?.dispose();
    this._chainHandle = null;
    if (this._socketKey) {
      this._sshSocketService.releaseSocket(this._socketKey);
    }
    this._socket = null;
    this._socketKey = null;
    this._activeConnections = 0;
    this._publishCounters();
  }
}
