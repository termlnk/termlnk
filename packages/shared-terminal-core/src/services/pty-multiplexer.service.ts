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

import type { IDriverState, IFrame, IOutboundFrame, IParticipant, IPtyMultiplexerService, IPtySource, IRegisteredPty, IRekeyResult, ISessionSnapshot, ISharedSession, RekeyReason, SharedTerminalRole } from '@termlnk/shared-terminal';
import type { Observable, Subscription } from 'rxjs';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { FrameChannel, FrameFlag, isWriterRole, SharedSessionState } from '@termlnk/shared-terminal';
import { BehaviorSubject, Subject } from 'rxjs';
import { DriverArbitrationService } from './driver-arbitration.service';
import { SessionKeyService } from './session-key.service';
import { SessionScrollback } from './session-scrollback';

/** Lines of scrollback to include in a snapshot. */
const DEFAULT_SNAPSHOT_SCROLLBACK_LINES = 1000;

/**
 * Per-session runtime state held by the mux.
 *
 * The mux is now an orchestrator: it owns the fanout subjects, the seq
 * counters, and the per-client metadata (role / displayName / publicKey /
 * joinedAt) — everything else (scrollback, driver arbitration, session keys)
 * is delegated to single-responsibility collaborators.
 */
interface ISessionRuntime {
  readonly source: IPtySource;
  readonly scrollback: SessionScrollback;
  readonly clients: Map<string, IClientEntry>;
  readonly participantsSubject: BehaviorSubject<readonly IParticipant[]>;
  readonly outputSub: Subscription;
  readonly resizeSub: Subscription;
  readonly arbitrationSubs: Subscription[];
  state: SharedSessionState;
  cols: number;
  rows: number;
  readonly seqCounters: Record<FrameChannel, number>;
}

interface IClientEntry {
  readonly role: SharedTerminalRole;
  readonly displayName: string;
  readonly joinedAt: number;
  /** Recipient X25519 public key for sessionKey wrapping; null = legacy paired-device path. */
  publicKey: Uint8Array | null;
}

/**
 * PTY multiplexer — fans a single PTY out to multiple attached clients.
 *
 * Architecture (post-refactor):
 *   - PTY output → scrollback.write + outbound$ (PtyData, broadcast)
 *   - Inbound PtyData → only the current driver's bytes reach the PTY
 *   - Inbound Control → mux interprets driver_request/release/resize, ignores SessionEvent
 *   - Driver state + heartbeat reap → DriverArbitrationService (mux just forwards
 *     handover notifications as session_event frames)
 *   - Session key lifecycle + per-recipient wrap → SessionKeyService (mux turns
 *     wrap results into Control frames and enforces the rekey ordering: every
 *     wrap is queued under the OLD key, then commitRotation publishes the NEW)
 *   - Ring buffer + xterm-headless snapshot → SessionScrollback
 *
 * Mux is the single place that touches `seqCounters` and `outbound$`. Every
 * outbound frame on the wire flows through `_broadcast` / `_unicast` so seq
 * monotonicity is preserved per channel.
 */
export class PtyMultiplexerService extends Disposable implements IPtyMultiplexerService {
  private readonly _sessions = new Map<string, ISessionRuntime>();
  private readonly _sessionsSubject = new BehaviorSubject<readonly ISharedSession[]>([]);
  private readonly _outboundSubject = new Subject<IOutboundFrame>();

  readonly sessions$ = this._sessionsSubject.asObservable();
  readonly outbound$ = this._outboundSubject.asObservable();

  constructor(
    @Inject(DriverArbitrationService) private readonly _driver: DriverArbitrationService,
    @Inject(SessionKeyService) private readonly _keyService: SessionKeyService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  override dispose(): void {
    for (const sessionId of [...this._sessions.keys()]) {
      this._destroySession(sessionId);
    }
    this._sessionsSubject.complete();
    this._outboundSubject.complete();
    super.dispose();
  }

  driverState$(sessionId: string): Observable<IDriverState> {
    return this._driver.driverState$(sessionId);
  }

  participants$(sessionId: string): Observable<readonly IParticipant[]> {
    const runtime = this._sessions.get(sessionId);
    if (!runtime) {
      return new BehaviorSubject<readonly IParticipant[]>([]).asObservable();
    }
    return runtime.participantsSubject.asObservable();
  }

  register(source: IPtySource): IRegisteredPty {
    if (this._sessions.has(source.id)) {
      throw new Error(`[PtyMultiplexerService] session already registered: ${source.id}`);
    }

    const scrollback = new SessionScrollback(source.cols, source.rows);
    const participantsSubject = new BehaviorSubject<readonly IParticipant[]>([]);
    this._driver.registerSession(source.id);
    this._keyService.registerSession(source.id);

    const outputSub = source.output$.subscribe({
      next: (chunk) => this._handlePtyOutput(source.id, chunk),
      error: (err) => this._logService.error(`[PtyMultiplexerService] PTY ${source.id} errored:`, err),
    });

    // Owner-side PTY geometry is authoritative for both scrollback parsing and
    // joiner xterm sizing. Without this subscription every owner-side window
    // resize silently drifts runtime + scrollback out of sync with the live
    // PTY, so joiners replay buffers parsed at a stale cols and zsh's
    // PROMPT_EOL_MARK clear-line escapes target the wrong cell.
    const resizeSub = source.resize$.subscribe({
      next: ({ cols, rows }) => this._handlePtySourceResize(source.id, cols, rows),
      error: (err) => this._logService.error(`[PtyMultiplexerService] PTY ${source.id} resize$ errored:`, err),
    });

    const runtime: ISessionRuntime = {
      source,
      scrollback,
      clients: new Map(),
      participantsSubject,
      outputSub,
      resizeSub,
      arbitrationSubs: [],
      state: SharedSessionState.Idle,
      cols: source.cols,
      rows: source.rows,
      seqCounters: {
        [FrameChannel.Control]: 0,
        [FrameChannel.PtyData]: 0,
        [FrameChannel.SessionEvent]: 0,
      },
    };
    this._sessions.set(source.id, runtime);

    // Translate arbitration state into wire events. Handover → SessionEvent
    // broadcast; client reap → just drop the participant (the disconnected
    // socket is what the client sees; no need to spam them with a synthetic
    // SessionEvent — the daemon already lost their attach).
    runtime.arbitrationSubs.push(
      this._driver.handovers$.subscribe((notice) => {
        if (notice.sessionId !== source.id) {
          return;
        }
        this._broadcastSessionEvent(source.id, {
          type: 'driver_handover',
          sessionId: source.id,
          fromClientId: notice.fromClientId,
          toClientId: notice.toClientId,
        });
        this._publishSessions();
      })
    );
    runtime.arbitrationSubs.push(
      this._driver.reaped$.subscribe((notice) => {
        if (notice.sessionId !== source.id) {
          return;
        }
        this._handleClientGone(runtime, notice.clientId, 'detach');
      })
    );

    this._publishSessions();

    return {
      sessionId: source.id,
      unregister: () => this._destroySession(source.id),
    };
  }

  async snapshot(sessionId: string): Promise<ISessionSnapshot> {
    const runtime = this._requireSession(sessionId);
    const serialized = await runtime.scrollback.serialize(DEFAULT_SNAPSHOT_SCROLLBACK_LINES);
    return {
      sessionId,
      title: runtime.source.title,
      cols: runtime.cols,
      rows: runtime.rows,
      serialized,
      observedSeq: runtime.seqCounters[FrameChannel.PtyData],
      state: runtime.state,
      driverId: this._currentDriverId(sessionId),
    };
  }

  setDriver(sessionId: string, clientId: string | null): void {
    this._requireSession(sessionId);
    this._driver.setDriver(sessionId, clientId);
  }

  lockDriver(sessionId: string, clientId: string): void {
    this._requireSession(sessionId);
    this._driver.lockDriver(sessionId, clientId);
  }

  unlockDriver(sessionId: string): void {
    this._requireSession(sessionId);
    this._driver.unlockDriver(sessionId);
  }

  kick(sessionId: string, clientId: string, reason?: string): void {
    const runtime = this._sessions.get(sessionId);
    if (!runtime || !runtime.clients.has(clientId)) {
      return;
    }
    this._sendControlToClient(sessionId, clientId, { type: 'kick', reason });
    this._handleClientGone(runtime, clientId, 'kick');
  }

  getSessionKey(sessionId: string): Uint8Array | null {
    return this._keyService.getKey(sessionId);
  }

  sessionKey$(sessionId: string): Observable<Uint8Array | null> {
    return this._keyService.key$(sessionId);
  }

  async rekey(sessionId: string, reason: RekeyReason): Promise<IRekeyResult> {
    const runtime = this._requireSession(sessionId);
    return this._rotateAndBroadcast(runtime, reason);
  }

  attachClient(
    sessionId: string,
    clientId: string,
    role: SharedTerminalRole,
    displayName?: string,
    publicKey?: Uint8Array
  ): void {
    const runtime = this._requireSession(sessionId);
    this._attachClientRuntime(runtime, clientId, role, displayName, publicKey);
  }

  detachClient(sessionId: string, clientId: string): void {
    const runtime = this._sessions.get(sessionId);
    if (!runtime || !runtime.clients.has(clientId)) {
      return;
    }
    this._handleClientGone(runtime, clientId, 'detach');
  }

  handleInbound(sessionId: string, clientId: string, frame: IFrame): void {
    const runtime = this._sessions.get(sessionId);
    if (!runtime || !runtime.clients.has(clientId)) {
      return;
    }

    this._driver.clientHeartbeat(sessionId, clientId);

    switch (frame.channel) {
      case FrameChannel.PtyData:
        this._handleInputFrame(runtime, clientId, frame);
        break;
      case FrameChannel.Control:
        this._handleControlFrame(runtime, clientId, frame);
        break;
      case FrameChannel.SessionEvent:
        // Clients must not emit session events; ignore to prevent spoofing.
        break;
    }
  }

  clientHeartbeat(sessionId: string, clientId: string): void {
    this._driver.clientHeartbeat(sessionId, clientId);
  }

  private _attachClientRuntime(
    runtime: ISessionRuntime,
    clientId: string,
    role: SharedTerminalRole,
    displayName?: string,
    publicKey?: Uint8Array
  ): void {
    if (runtime.clients.has(clientId)) {
      // Re-attach: refresh role and keep prior publicKey unless the caller supplies one.
      const existing = runtime.clients.get(clientId)!;
      runtime.clients.set(clientId, {
        role,
        displayName: displayName ?? existing.displayName,
        joinedAt: existing.joinedAt,
        publicKey: publicKey ?? existing.publicKey,
      });
      this._driver.refreshClientRole(runtime.source.id, clientId, role);
      this._publishParticipants(runtime);
      return;
    }

    const now = Date.now();
    runtime.clients.set(clientId, {
      role,
      displayName: displayName ?? clientId,
      joinedAt: now,
      publicKey: publicKey ?? null,
    });
    this._driver.attachClient(runtime.source.id, clientId, role);

    // Keyed-participant flow — make sure THIS specific joiner can decrypt
    // frames encrypted under the per-session symmetric key. First keyed
    // attach generates the key and broadcasts a wrapped copy; subsequent
    // keyed attaches receive a unicast wrap (the key did NOT rotate).
    if (publicKey && this._keyService.isAvailable()) {
      const existingKey = this._keyService.getKey(runtime.source.id);
      if (!existingKey) {
        void this._rotateAndBroadcast(runtime, 'manual').catch((err) => {
          this._logService.error(`[PtyMultiplexerService] initial rekey for ${runtime.source.id} failed:`, err);
        });
      } else {
        void this._keyService
          .wrapForClient(runtime.source.id, clientId, publicKey, 'manual')
          .then((wrap) => {
            if (wrap) {
              this._sendControlToClient(runtime.source.id, clientId, SessionKeyService.toControlPayload(wrap));
            }
          })
          .catch((err) => {
            this._logService.error(`[PtyMultiplexerService] wrap-for-client ${clientId} failed:`, err);
          });
      }
    }

    this._refreshRuntimeState(runtime);

    const sessionId = runtime.source.id;
    // Unicast snapshot to the new client.
    this._sendSnapshot(sessionId, clientId).catch((err) => {
      this._logService.error(`[PtyMultiplexerService] snapshot to ${clientId} failed:`, err);
    });
    // Broadcast participant_joined to all (including the new client).
    this._broadcastSessionEvent(sessionId, {
      type: 'participant_joined',
      sessionId,
      clientId,
      role,
      displayName,
    });

    this._publishParticipants(runtime);
  }

  /**
   * Common "client is gone" path (detach, kick, heartbeat reap). Drops the
   * runtime entry, propagates to arbitration (driver clears if it was them),
   * broadcasts participant_left, and rotates the key when the gone client
   * held a wrapped copy (forward secrecy).
   */
  private _handleClientGone(
    runtime: ISessionRuntime,
    clientId: string,
    reason: RekeyReason
  ): void {
    const entry = runtime.clients.get(clientId);
    const wasKeyed = Boolean(entry?.publicKey);
    runtime.clients.delete(clientId);
    this._driver.detachClient(runtime.source.id, clientId);

    this._refreshRuntimeState(runtime);

    this._broadcastSessionEvent(runtime.source.id, {
      type: 'participant_left',
      sessionId: runtime.source.id,
      clientId,
    });
    this._publishParticipants(runtime);

    if (wasKeyed && this._keyService.getKey(runtime.source.id) !== null) {
      const hasRemainingKeyed = [...runtime.clients.values()].some((c) => c.publicKey);
      if (hasRemainingKeyed) {
        void this._rotateAndBroadcast(runtime, reason).catch((err) => {
          this._logService.error(`[PtyMultiplexerService] forward-secrecy rekey on detach failed:`, err);
        });
      } else {
        this._keyService.clear(runtime.source.id);
      }
    }
  }

  private async _rotateAndBroadcast(runtime: ISessionRuntime, reason: RekeyReason): Promise<IRekeyResult> {
    const recipients = [...runtime.clients].map(([clientId, entry]) => ({
      clientId,
      publicKey: entry.publicKey,
    }));
    const broadcast = await this._keyService.rotate(runtime.source.id, recipients, reason);
    // Queue every wrap under the OLD key first (the daemon-side transport
    // hasn't seen the new key yet because we haven't called commitRotation).
    for (const wrap of broadcast.wraps) {
      this._sendControlToClient(runtime.source.id, wrap.clientId, SessionKeyService.toControlPayload(wrap));
    }
    // Publish the new key — daemon transport swaps its encryption key now.
    this._keyService.commitRotation(runtime.source.id);
    return {
      sessionId: broadcast.sessionId,
      reason: broadcast.reason,
      recipientCount: broadcast.wraps.length,
      unwrappedClientIds: broadcast.unwrappedClientIds,
    };
  }

  private _requireSession(sessionId: string): ISessionRuntime {
    const runtime = this._sessions.get(sessionId);
    if (!runtime) {
      throw new Error(`[PtyMultiplexerService] unknown session ${sessionId}`);
    }
    return runtime;
  }

  private _handlePtyOutput(sessionId: string, chunk: Uint8Array): void {
    const runtime = this._sessions.get(sessionId);
    if (!runtime) {
      return;
    }
    runtime.scrollback.write(chunk);
    if (runtime.clients.size === 0) {
      return;
    }
    this._broadcast(sessionId, FrameChannel.PtyData, FrameFlag.None, chunk);
  }

  /**
   * Single entry point for PTY geometry changes — invoked whenever the
   * owner-side PtySource emits resize$ (driver control frame or owner-local
   * window resize alike). Keeps runtime, headless scrollback, and every
   * joiner xterm in lockstep with the live PTY.
   */
  private _handlePtySourceResize(sessionId: string, cols: number, rows: number): void {
    const runtime = this._sessions.get(sessionId);
    if (!runtime) {
      return;
    }
    if (runtime.cols === cols && runtime.rows === rows) {
      return;
    }
    runtime.cols = cols;
    runtime.rows = rows;
    runtime.scrollback.resize(cols, rows);
    this._broadcastSessionEvent(sessionId, {
      type: 'resize',
      sessionId,
      cols,
      rows,
    });
    this._publishSessions();
  }

  private _handleInputFrame(runtime: ISessionRuntime, clientId: string, frame: IFrame): void {
    const client = runtime.clients.get(clientId)!;
    if (!isWriterRole(client.role)) {
      return;
    }
    if (!this._driver.isDriver(runtime.source.id, clientId)) {
      return;
    }
    try {
      runtime.source.write(frame.payload);
    } catch (err) {
      this._logService.error(`[PtyMultiplexerService] PTY ${runtime.source.id} write failed:`, err);
    }
  }

  private _handleControlFrame(runtime: ISessionRuntime, clientId: string, frame: IFrame): void {
    let parsed: { type?: string };
    try {
      parsed = JSON.parse(new TextDecoder().decode(frame.payload)) as { type?: string };
    } catch (err) {
      this._logService.error(`[PtyMultiplexerService] invalid control payload from ${clientId}:`, err);
      return;
    }
    switch (parsed.type) {
      case 'driver_request':
        this._driver.requestDriver(runtime.source.id, clientId);
        break;
      case 'driver_release':
        this._driver.releaseDriver(runtime.source.id, clientId);
        break;
      case 'heartbeat':
        // Timestamp already updated in handleInbound.
        break;
      case 'resize': {
        const r = parsed as { type: 'resize'; cols?: number; rows?: number };
        if (
          this._driver.isDriver(runtime.source.id, clientId)
          && Number.isInteger(r.cols)
          && Number.isInteger(r.rows)
        ) {
          try {
            // Single entry point: mutate the live PTY only. The owner-side
            // session emits resize$ which we subscribe to in register(),
            // so runtime/scrollback/broadcast updates flow from that one path
            // regardless of whether the trigger was a driver control frame or
            // an owner-local window resize.
            runtime.source.resize(r.cols!, r.rows!);
          } catch (err) {
            this._logService.error('[PtyMultiplexerService] PTY resize failed:', err);
          }
        }
        break;
      }
      default:
        // Unknown types are ignored for forward compatibility.
        break;
    }
  }

  private _broadcast(sessionId: string, channel: FrameChannel, flags: number, payload: Uint8Array): void {
    const runtime = this._sessions.get(sessionId);
    if (!runtime) {
      return;
    }
    const seq = runtime.seqCounters[channel];
    runtime.seqCounters[channel] = (seq + 1) >>> 0;
    this._outboundSubject.next({
      sessionId,
      target: 'broadcast',
      frame: { channel, flags, seq, payload },
    });
  }

  private _broadcastSessionEvent(sessionId: string, event: object): void {
    const payload = new TextEncoder().encode(JSON.stringify(event));
    this._broadcast(sessionId, FrameChannel.SessionEvent, FrameFlag.None, payload);
  }

  private _sendControlToClient(sessionId: string, clientId: string, message: object): void {
    const runtime = this._sessions.get(sessionId);
    if (!runtime) {
      return;
    }
    const seq = runtime.seqCounters[FrameChannel.Control];
    runtime.seqCounters[FrameChannel.Control] = (seq + 1) >>> 0;
    const payload = new TextEncoder().encode(JSON.stringify(message));
    this._outboundSubject.next({
      sessionId,
      target: clientId,
      frame: { channel: FrameChannel.Control, flags: FrameFlag.None, seq, payload },
    });
  }

  private async _sendSnapshot(sessionId: string, clientId: string): Promise<void> {
    const snap = await this.snapshot(sessionId);
    const runtime = this._sessions.get(sessionId);
    if (!runtime) {
      return;
    }
    const seq = runtime.seqCounters[FrameChannel.SessionEvent];
    runtime.seqCounters[FrameChannel.SessionEvent] = (seq + 1) >>> 0;
    const payload = new TextEncoder().encode(JSON.stringify({ type: 'snapshot', ...snap }));
    this._outboundSubject.next({
      sessionId,
      target: clientId,
      frame: { channel: FrameChannel.SessionEvent, flags: FrameFlag.None, seq, payload },
    });
  }

  private _publishSessions(): void {
    const out: ISharedSession[] = [];
    for (const runtime of this._sessions.values()) {
      out.push({
        id: runtime.source.id,
        title: runtime.source.title,
        state: runtime.state,
        cols: runtime.cols,
        rows: runtime.rows,
        createdAt: runtime.participantsSubject.getValue()[0]?.joinedAt ?? Date.now(),
        participantIds: [...runtime.clients.keys()],
        driverId: this._currentDriverId(runtime.source.id),
      });
    }
    this._sessionsSubject.next(out);
  }

  private _publishParticipants(runtime: ISessionRuntime): void {
    const list: IParticipant[] = [];
    for (const [clientId, entry] of runtime.clients) {
      list.push({
        connectionId: clientId,
        displayName: entry.displayName,
        role: entry.role,
        joinedAt: entry.joinedAt,
        isCurrent: false,
      });
    }
    runtime.participantsSubject.next(list);
    this._publishSessions();
  }

  private _destroySession(sessionId: string): void {
    const runtime = this._sessions.get(sessionId);
    if (!runtime) {
      return;
    }
    runtime.outputSub.unsubscribe();
    runtime.resizeSub.unsubscribe();
    for (const sub of runtime.arbitrationSubs) {
      sub.unsubscribe();
    }
    // Notify all attached clients first; payload encode still uses the per-runtime seq counter.
    this._broadcastSessionEvent(sessionId, { type: 'session_closed', sessionId });
    runtime.state = SharedSessionState.Closed;
    runtime.scrollback.dispose();
    runtime.participantsSubject.complete();
    this._driver.unregisterSession(sessionId);
    this._keyService.unregisterSession(sessionId);
    this._sessions.delete(sessionId);
    this._publishSessions();
  }

  private _refreshRuntimeState(runtime: ISessionRuntime): void {
    if (runtime.clients.size > 0) {
      runtime.state = SharedSessionState.Active;
    } else {
      runtime.state = SharedSessionState.Idle;
    }
    this._publishSessions();
  }

  private _currentDriverId(sessionId: string): string | null {
    // Delegate to the arbitration service's explicit sync getter — avoids the
    // implicit "driverState$ is a BehaviorSubject" assumption that a previous
    // version relied on via subscribe/unsubscribe.
    return this._driver.getDriverState(sessionId)?.driverId ?? null;
  }
}
