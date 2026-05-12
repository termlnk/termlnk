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

import type { AppStateStatus, NativeEventSubscription } from 'react-native';
import type { IMobileSshConnectOptions, IMobileSshSession, MobileSshClientService } from './mobile-ssh-client.service';
import { Disposable } from '@termlnk/core';
import { AppState } from 'react-native';
import { BehaviorSubject } from 'rxjs';
import { buildShellResumptionCommand } from './mobile-shell-resumption';

// Lifecycle wrapper around MobileSshClientService that survives iOS app-state
// transitions. Holds the connect options needed to re-establish the SSH channel after
// iOS kills the TCP connection (~30s in background), then re-runs the shell-resumption
// command which auto-attaches the user's tmux/screen session on the remote.
//
// One ManagedSshSession instance per (host, user) tuple. Caller is responsible for
// disposing when the user explicitly closes the session — AppState-driven reconnects
// run silently. The state$ Observable exposes:
//   - 'connected'    SSH up, shell started
//   - 'reconnecting' AppState came back to active, awaiting handshake
//   - 'disconnected' SSH closed, no reconnect scheduled (terminal state until explicit
//                    .reconnect() call)
//   - 'error'        last reconnect attempt failed; .lastError$ has the message

export type ManagedSshState = 'connected' | 'reconnecting' | 'disconnected' | 'error';

export interface IManagedSshSession {
  readonly hostId: string;
  readonly state$: BehaviorSubject<ManagedSshState>;
  readonly lastError$: BehaviorSubject<string | null>;
  readonly underlying: IMobileSshSession | null;
  reconnect: () => Promise<void>;
  close: () => Promise<void>;
}

export class ManagedSshSession extends Disposable implements IManagedSshSession {
  readonly state$ = new BehaviorSubject<ManagedSshState>('disconnected');
  readonly lastError$ = new BehaviorSubject<string | null>(null);

  private _underlying: IMobileSshSession | null = null;

  constructor(
    readonly hostId: string,
    private readonly _client: MobileSshClientService,
    private readonly _options: IMobileSshConnectOptions
  ) {
    super();
  }

  override dispose(): void {
    if (this._underlying) {
      this._underlying.disconnect();
      this._underlying = null;
    }
    this.state$.next('disconnected');
    this.state$.complete();
    this.lastError$.complete();
    super.dispose();
  }

  get underlying(): IMobileSshSession | null {
    return this._underlying;
  }

  // Idempotent: noop when already connected. Awaitable so the UI can drive a manual
  // refresh button. After this resolves, .underlying gives the active session.
  async reconnect(): Promise<void> {
    if (this.state$.getValue() === 'reconnecting') {
      return;
    }
    if (this._underlying && this._underlying.state === 'connected') {
      return;
    }
    this.state$.next('reconnecting');
    try {
      this._underlying = await this._client.connect(this._options);
      const { command } = buildShellResumptionCommand({ hostId: this.hostId });
      await this._underlying.startShell();
      await this._underlying.writeToShell(command);
      this.state$.next('connected');
      this.lastError$.next(null);
    } catch (err) {
      this.lastError$.next(err instanceof Error ? err.message : String(err));
      this.state$.next('error');
    }
  }

  async close(): Promise<void> {
    if (this._underlying) {
      this._underlying.disconnect();
      this._underlying = null;
    }
    this.state$.next('disconnected');
  }
}

// Owns N ManagedSshSessions plus a single AppState subscription that drives reconnect
// attempts whenever the app returns to the foreground. This is the entry point the UI
// layer should use — never instantiate ManagedSshSession directly so reconnect timing
// stays centralized.
export class MobileSshSessionManager extends Disposable {
  private readonly _sessions = new Map<string, ManagedSshSession>();
  private readonly _appStateSub: NativeEventSubscription;

  constructor(private readonly _client: MobileSshClientService) {
    super();
    this._appStateSub = AppState.addEventListener('change', this._onAppStateChange);
  }

  override dispose(): void {
    this._appStateSub.remove();
    for (const session of this._sessions.values()) {
      session.dispose();
    }
    this._sessions.clear();
    super.dispose();
  }

  // Returns an existing managed session for `hostId`, creating one in 'disconnected'
  // state if absent. Call .reconnect() on the result to actually open the SSH channel
  // (lazy connect lets the UI render the host detail screen before showing a spinner).
  getOrCreate(hostId: string, options: IMobileSshConnectOptions): ManagedSshSession {
    const existing = this._sessions.get(hostId);
    if (existing) {
      return existing;
    }
    const created = new ManagedSshSession(hostId, this._client, options);
    this._sessions.set(hostId, created);
    return created;
  }

  remove(hostId: string): void {
    const session = this._sessions.get(hostId);
    if (session) {
      session.dispose();
      this._sessions.delete(hostId);
    }
  }

  private readonly _onAppStateChange = (next: AppStateStatus): void => {
    if (next !== 'active') {
      return;
    }
    // Foreground transition: SSH may have been culled while backgrounded. Each session
    // re-attempts independently; tmux session_name is stable so the user's screen state
    // comes back when the handshake completes. Errors stay in lastError$ for the UI.
    for (const session of this._sessions.values()) {
      if (session.state$.getValue() !== 'connected') {
        void session.reconnect();
      }
    }
  };
}
