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

import type { IDriverState, SharedTerminalRole } from '@termlnk/shared-terminal';
import type { Observable } from 'rxjs';
import { Disposable, ILogService } from '@termlnk/core';
import { isWriterRole, SHARED_TERMINAL_DRIVER_HEARTBEAT_TIMEOUT_MS } from '@termlnk/shared-terminal';
import { BehaviorSubject, Subject } from 'rxjs';

/**
 * Reaper interval — fast enough that a 5 s heartbeat timeout reads "snappy",
 * cheap enough that hundreds of attached clients stay flat on CPU.
 */
const REAP_INTERVAL_MS = 1000;

/**
 * How long a client may stop heartbeating before mux treats it as gone. We
 * key off `SHARED_TERMINAL_DRIVER_HEARTBEAT_TIMEOUT_MS` (5 s) and apply a 6×
 * factor so brief jitters don't evict a live joiner; the relay does not push
 * close events, so heartbeats are our only liveness signal.
 */
const CLIENT_REAP_THRESHOLD_MS = SHARED_TERMINAL_DRIVER_HEARTBEAT_TIMEOUT_MS * 6;

/** Notification emitted on every auto-driver-handover (heartbeat reap). */
export interface IDriverHandoverNotice {
  readonly sessionId: string;
  readonly fromClientId: string | null;
  readonly toClientId: string | null;
}

/** Notification emitted when the reaper evicts a client. */
export interface IClientReapedNotice {
  readonly sessionId: string;
  readonly clientId: string;
}

interface ISessionState {
  driverId: string | null;
  driverHeartbeatAt: number;
  driverLocked: boolean;
  readonly clients: Map<string, IClientLiveness>;
  readonly subject: BehaviorSubject<IDriverState>;
}

interface IClientLiveness {
  readonly role: SharedTerminalRole;
  lastHeartbeatAt: number;
}

/**
 * Driver arbitration + client liveness reaper, extracted from PtyMultiplexer.
 *
 * Owns:
 *  - Per-session `IDriverState` (`driverId`, `lastHeartbeatAt`, `locked`)
 *  - Per-client `lastHeartbeatAt` (used for liveness eviction)
 *  - Two notification streams (`handovers$`, `reaped$`) so the mux can fan
 *    out the corresponding wire events (SessionEvent / Control frames) at
 *    its own seq counter.
 *
 * Pure state machine: this class does NOT touch the wire or any other service.
 * Callers (PtyMultiplexer) are responsible for translating state transitions
 * into outbound frames.
 */
export class DriverArbitrationService extends Disposable {
  private readonly _sessions = new Map<string, ISessionState>();
  private readonly _handovers$ = new Subject<IDriverHandoverNotice>();
  private readonly _reaped$ = new Subject<IClientReapedNotice>();
  readonly handovers$: Observable<IDriverHandoverNotice> = this._handovers$.asObservable();
  readonly reaped$: Observable<IClientReapedNotice> = this._reaped$.asObservable();

  private _timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @ILogService private readonly _logService: ILogService
  ) {
    super();
    this._timer = setInterval(() => {
      this._reapStaleDrivers();
      this._reapStaleClients();
    }, REAP_INTERVAL_MS);
    if (typeof this._timer === 'object' && this._timer !== null && 'unref' in this._timer) {
      (this._timer as { unref: () => void }).unref();
    }
  }

  override dispose(): void {
    super.dispose();
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    for (const state of this._sessions.values()) {
      state.subject.complete();
    }
    this._sessions.clear();
    this._handovers$.complete();
    this._reaped$.complete();
  }

  registerSession(sessionId: string): void {
    if (this._sessions.has(sessionId)) {
      return;
    }
    this._sessions.set(sessionId, {
      driverId: null,
      driverHeartbeatAt: 0,
      driverLocked: false,
      clients: new Map(),
      subject: new BehaviorSubject<IDriverState>({
        sessionId,
        driverId: null,
        lastHeartbeatAt: 0,
        locked: false,
      }),
    });
  }

  unregisterSession(sessionId: string): void {
    const state = this._sessions.get(sessionId);
    if (!state) {
      return;
    }
    state.subject.complete();
    state.clients.clear();
    this._sessions.delete(sessionId);
  }

  /**
   * Returns an Observable of the per-session driver state. Empty for unknown
   * session ids — matches the leniency the renderer relies on (see notes in
   * the original pty-multiplexer.service.ts).
   */
  driverState$(sessionId: string): Observable<IDriverState> {
    const state = this._sessions.get(sessionId);
    if (!state) {
      return new BehaviorSubject<IDriverState>({
        sessionId,
        driverId: null,
        lastHeartbeatAt: 0,
        locked: false,
      }).asObservable();
    }
    return state.subject.asObservable();
  }

  /**
   * Sync snapshot of the current driver state, or null if the session is not
   * registered. Used by mux to compose `ISharedSession.driverId` without
   * subscribing to its own observable.
   */
  getDriverState(sessionId: string): IDriverState | null {
    return this._sessions.get(sessionId)?.subject.getValue() ?? null;
  }

  attachClient(sessionId: string, clientId: string, role: SharedTerminalRole): void {
    const state = this._requireSession(sessionId);
    const now = Date.now();
    state.clients.set(clientId, {
      role,
      lastHeartbeatAt: now,
    });
  }

  refreshClientRole(sessionId: string, clientId: string, role: SharedTerminalRole): void {
    const state = this._sessions.get(sessionId);
    if (!state) {
      return;
    }
    const liveness = state.clients.get(clientId);
    if (!liveness) {
      return;
    }
    state.clients.set(clientId, { role, lastHeartbeatAt: Date.now() });
  }

  detachClient(sessionId: string, clientId: string): void {
    const state = this._sessions.get(sessionId);
    if (!state) {
      return;
    }
    state.clients.delete(clientId);
    if (state.driverId === clientId) {
      const previous = state.driverId;
      state.driverId = null;
      state.driverLocked = false;
      state.driverHeartbeatAt = 0;
      this._publish(sessionId, state);
      this._handovers$.next({ sessionId, fromClientId: previous, toClientId: null });
    }
  }

  hasClient(sessionId: string, clientId: string): boolean {
    const state = this._sessions.get(sessionId);
    if (!state) {
      return false;
    }
    return state.clients.has(clientId);
  }

  setDriver(sessionId: string, clientId: string | null): IDriverHandoverNotice | null {
    const state = this._requireSession(sessionId);
    if (clientId !== null) {
      const liveness = state.clients.get(clientId);
      if (!liveness) {
        throw new Error(`[DriverArbitrationService] cannot set driver to non-attached client ${clientId}`);
      }
      if (!isWriterRole(liveness.role)) {
        throw new Error(`[DriverArbitrationService] role ${liveness.role} is not allowed to be driver`);
      }
    }
    const previous = state.driverId;
    state.driverId = clientId;
    state.driverHeartbeatAt = clientId ? Date.now() : 0;
    this._publish(sessionId, state);
    const handover: IDriverHandoverNotice = { sessionId, fromClientId: previous, toClientId: clientId };
    this._handovers$.next(handover);
    return handover;
  }

  lockDriver(sessionId: string, clientId: string): void {
    const state = this._requireSession(sessionId);
    if (!state.clients.has(clientId)) {
      throw new Error(`[DriverArbitrationService] cannot lock driver to non-attached client ${clientId}`);
    }
    state.driverId = clientId;
    state.driverLocked = true;
    state.driverHeartbeatAt = Date.now();
    this._publish(sessionId, state);
  }

  unlockDriver(sessionId: string): void {
    const state = this._requireSession(sessionId);
    state.driverLocked = false;
    this._publish(sessionId, state);
  }

  requestDriver(sessionId: string, clientId: string): IDriverHandoverNotice | null {
    const state = this._sessions.get(sessionId);
    if (!state) {
      return null;
    }
    const liveness = state.clients.get(clientId);
    if (!liveness || !isWriterRole(liveness.role)) {
      return null;
    }
    if (state.driverLocked && state.driverId !== clientId) {
      return null;
    }
    const previous = state.driverId;
    state.driverId = clientId;
    state.driverHeartbeatAt = Date.now();
    this._publish(sessionId, state);
    const handover: IDriverHandoverNotice = { sessionId, fromClientId: previous, toClientId: clientId };
    this._handovers$.next(handover);
    return handover;
  }

  releaseDriver(sessionId: string, clientId: string): boolean {
    const state = this._sessions.get(sessionId);
    if (!state || state.driverId !== clientId) {
      return false;
    }
    state.driverId = null;
    state.driverHeartbeatAt = 0;
    this._publish(sessionId, state);
    return true;
  }

  isDriver(sessionId: string, clientId: string): boolean {
    return this._sessions.get(sessionId)?.driverId === clientId;
  }

  clientHeartbeat(sessionId: string, clientId: string): void {
    const state = this._sessions.get(sessionId);
    if (!state) {
      return;
    }
    const liveness = state.clients.get(clientId);
    if (!liveness) {
      return;
    }
    const now = Date.now();
    liveness.lastHeartbeatAt = now;
    if (state.driverId === clientId) {
      state.driverHeartbeatAt = now;
      this._publish(sessionId, state);
    }
  }

  private _requireSession(sessionId: string): ISessionState {
    const state = this._sessions.get(sessionId);
    if (!state) {
      throw new Error(`[DriverArbitrationService] unknown session ${sessionId}`);
    }
    return state;
  }

  private _publish(sessionId: string, state: ISessionState): void {
    state.subject.next({
      sessionId,
      driverId: state.driverId,
      lastHeartbeatAt: state.driverHeartbeatAt,
      locked: state.driverLocked,
    });
  }

  private _reapStaleDrivers(): void {
    const now = Date.now();
    for (const [sessionId, state] of this._sessions) {
      if (state.driverId === null || state.driverLocked) {
        continue;
      }
      if (now - state.driverHeartbeatAt > SHARED_TERMINAL_DRIVER_HEARTBEAT_TIMEOUT_MS) {
        const previous = state.driverId;
        state.driverId = null;
        state.driverHeartbeatAt = 0;
        this._publish(sessionId, state);
        this._handovers$.next({ sessionId, fromClientId: previous, toClientId: null });
      }
    }
  }

  private _reapStaleClients(): void {
    const now = Date.now();
    for (const [sessionId, state] of this._sessions) {
      for (const [clientId, liveness] of state.clients) {
        if (now - liveness.lastHeartbeatAt <= CLIENT_REAP_THRESHOLD_MS) {
          continue;
        }
        this._logService.log(`[DriverArbitrationService] reaping stale client ${clientId} (no heartbeat for ${now - liveness.lastHeartbeatAt}ms)`);
        state.clients.delete(clientId);
        if (state.driverId === clientId) {
          const previous = state.driverId;
          state.driverId = null;
          state.driverHeartbeatAt = 0;
          state.driverLocked = false;
          this._publish(sessionId, state);
          this._handovers$.next({ sessionId, fromClientId: previous, toClientId: null });
        }
        this._reaped$.next({ sessionId, clientId });
      }
    }
  }
}
