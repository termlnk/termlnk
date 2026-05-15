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

// Foreground/background SSH lifecycle manager. P6.9-7 re-build on top of
// @termlnk/react-native-russh.
//
// Pattern from P6.4: maintain N managed sessions; on AppState `active`,
// walk all sessions and call reconnect() on any that died while the app
// was backgrounded. Each session keeps its original IMobileSshConnectOptions
// + the resumption command (tmux/screen) so a fresh SSH+shell pair can be
// re-established without UI intervention.

import type { NativeEventSubscription } from 'react-native';
import type { IMobileSshConnectOptions, IMobileSshSession, MobileSshClientService } from './mobile-ssh-client.service';
import { Disposable } from '@termlnk/core';
import { AppState } from 'react-native';
import { BehaviorSubject, Subject } from 'rxjs';

export type ManagedSessionState = 'disconnected' | 'connecting' | 'reconnecting' | 'connected' | 'error';

export interface IManagedSshSession {
  readonly hostId: string;
  readonly state$: BehaviorSubject<ManagedSessionState>;
  readonly session$: BehaviorSubject<IMobileSshSession | null>;
  readonly lastError$: BehaviorSubject<string | null>;
  readonly reconnected$: Subject<void>;
  reconnect: () => Promise<void>;
  close: () => void;
}

class ManagedSshSession extends Disposable implements IManagedSshSession {
  readonly state$ = new BehaviorSubject<ManagedSessionState>('disconnected');
  readonly session$ = new BehaviorSubject<IMobileSshSession | null>(null);
  readonly lastError$ = new BehaviorSubject<string | null>(null);
  readonly reconnected$ = new Subject<void>();

  private _resumptionCommand: string | null = null;

  constructor(
    readonly hostId: string,
    private readonly _client: MobileSshClientService,
    private readonly _connectOptions: IMobileSshConnectOptions
  ) {
    super();
  }

  setResumptionCommand(cmd: string | null): void {
    this._resumptionCommand = cmd;
  }

  async reconnect(): Promise<void> {
    const previous = this.session$.value;
    if (previous) {
      previous.disconnect();
      this.session$.next(null);
    }
    this.state$.next(previous ? 'reconnecting' : 'connecting');
    this.lastError$.next(null);
    try {
      const session = await this._client.connect(this._connectOptions);
      await session.startShell();
      if (this._resumptionCommand) {
        await session.writeToShell(this._resumptionCommand);
      }
      this.session$.next(session);
      this.state$.next('connected');
      this.reconnected$.next();
    } catch (err) {
      this.lastError$.next(err instanceof Error ? err.message : String(err));
      this.state$.next('error');
    }
  }

  close(): void {
    const s = this.session$.value;
    if (s) {
      s.disconnect();
      this.session$.next(null);
    }
    this.state$.next('disconnected');
  }

  override dispose(): void {
    this.close();
    this.state$.complete();
    this.session$.complete();
    this.lastError$.complete();
    this.reconnected$.complete();
    super.dispose();
  }
}

export class MobileSshSessionManager extends Disposable {
  private readonly _sessions = new Map<string, ManagedSshSession>();
  private _appStateSub: NativeEventSubscription | null = null;
  private _previousState: string = AppState.currentState;

  constructor(private readonly _client: MobileSshClientService) {
    super();
    this._appStateSub = AppState.addEventListener('change', this._onAppStateChange);
  }

  override dispose(): void {
    if (this._appStateSub) {
      this._appStateSub.remove();
      this._appStateSub = null;
    }
    for (const session of this._sessions.values()) {
      session.dispose();
    }
    this._sessions.clear();
    super.dispose();
  }

  manage(
    hostId: string,
    connectOptions: IMobileSshConnectOptions,
    opts?: { resumptionCommand?: string | null }
  ): IManagedSshSession {
    const existing = this._sessions.get(hostId);
    if (existing) {
      return existing;
    }
    const session = new ManagedSshSession(hostId, this._client, connectOptions);
    if (opts?.resumptionCommand !== undefined) {
      session.setResumptionCommand(opts.resumptionCommand);
    }
    this._sessions.set(hostId, session);
    return session;
  }

  release(hostId: string): void {
    const session = this._sessions.get(hostId);
    if (!session) {
      return;
    }
    session.dispose();
    this._sessions.delete(hostId);
  }

  private readonly _onAppStateChange = (next: string): void => {
    const previous = this._previousState;
    this._previousState = next;
    if (previous !== 'active' && next === 'active') {
      for (const session of this._sessions.values()) {
        // Reconnect only sessions that are not currently in a happy state.
        const state = session.state$.value;
        if (state === 'disconnected' || state === 'error') {
          void session.reconnect();
        }
      }
    }
  };
}
