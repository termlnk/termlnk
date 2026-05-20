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

import type { IDaemonKeypairService, IDriverState, IFrame, IOutboundFrame, IParticipant, IPtyMultiplexerService, IPtySource, IRegisteredPty, IRekeyResult, ISessionSnapshot, ISharedSession, ISharedTerminalCryptoService, RekeyReason, SharedTerminalRole } from '@termlnk/shared-terminal';
import type { Observable, Subscription } from 'rxjs';
import { Disposable, ILogService, Inject, Optional } from '@termlnk/core';
import { FrameChannel, FrameFlag, IDaemonKeypairService as IDaemonKeypairServiceId, ISharedTerminalCryptoService as ISharedTerminalCryptoServiceId, isWriterRole, SHARED_TERMINAL_DRIVER_HEARTBEAT_TIMEOUT_MS, SHARED_TERMINAL_RING_BUFFER_BYTES, SharedSessionState } from '@termlnk/shared-terminal';
import { BehaviorSubject, EMPTY, Subject } from 'rxjs';
import { bytesToBase64Url } from '../utils/encoding';
import { HeadlessSession } from '../utils/headless-session';
import { RingBuffer } from '../utils/ring-buffer';

/** Lines of scrollback to include in a snapshot. */
const DEFAULT_SNAPSHOT_SCROLLBACK_LINES = 1000;

/** Per-session runtime state. */
interface ISessionRuntime {
  readonly source: IPtySource;
  readonly ringBuffer: RingBuffer;
  readonly headless: HeadlessSession;
  readonly clients: Map<string, IClientEntry>;
  readonly participantsSubject: BehaviorSubject<readonly IParticipant[]>;
  readonly driverSubject: BehaviorSubject<IDriverState>;
  readonly outputSub: Subscription;
  driverId: string | null;
  driverHeartbeatAt: number;
  driverLocked: boolean;
  state: SharedSessionState;
  cols: number;
  rows: number;
  readonly seqCounters: Record<FrameChannel, number>;
  /** Current 32-byte symmetric session key used to encrypt PTY frames. */
  sessionKey: Uint8Array | null;
}

interface IClientEntry {
  readonly role: SharedTerminalRole;
  readonly displayName: string;
  readonly joinedAt: number;
  lastHeartbeatAt: number;
  /** Recipient's X25519 public key for session-key wrapping; null = legacy paired-device flow. */
  publicKey: Uint8Array | null;
}

/**
 * PTY multiplexer — fans out a single PTY to multiple attached clients.
 *
 * Key invariants:
 * - PTY output fans out to all attached clients (PtyData channel, target='broadcast').
 * - PTY output is also written to a ring buffer so late-attaching clients catch up.
 * - Only the driver client's inbound PtyData frames reach the underlying PTY.
 * - Driver heartbeat timeout (5s) auto-clears the driver so another writer can take over.
 * - Frame seq is a per-channel monotonically-increasing uint32.
 *
 * Each session maintains an xterm-headless instance for serialized state snapshots.
 */
export class PtyMultiplexerService extends Disposable implements IPtyMultiplexerService {
  private readonly _sessions = new Map<string, ISessionRuntime>();
  private readonly _sessionsSubject = new BehaviorSubject<readonly ISharedSession[]>([]);
  private readonly _outboundSubject = new Subject<IOutboundFrame>();

  readonly sessions$ = this._sessionsSubject.asObservable();
  readonly outbound$ = this._outboundSubject.asObservable();

  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @ILogService private readonly _logService: ILogService,
    @Inject(ISharedTerminalCryptoServiceId) private readonly _crypto: ISharedTerminalCryptoService,
    @Optional(IDaemonKeypairServiceId)
    private readonly _daemonKeypair: IDaemonKeypairService | null = null
  ) {
    super();
    // Scan for stale drivers every second.
    this._heartbeatTimer = setInterval(() => this._reapStaleDrivers(), 1000);
    if (typeof this._heartbeatTimer === 'object' && this._heartbeatTimer !== null && 'unref' in this._heartbeatTimer) {
      (this._heartbeatTimer as { unref: () => void }).unref();
    }
  }

  override dispose(): void {
    if (this._heartbeatTimer !== null) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
    for (const sessionId of [...this._sessions.keys()]) {
      this._destroySession(sessionId);
    }
    this._sessionsSubject.complete();
    this._outboundSubject.complete();
    super.dispose();
  }

  driverState$(sessionId: string): Observable<IDriverState> {
    // Return EMPTY for unknown sessions rather than throwing — the renderer
    // may briefly subscribe to a session that was just unregistered (race
    // between sessions$ removal and a re-render iterating sessions.map). A
    // sync throw here propagates through the tRPC subscription and stalls
    // the main process event loop.
    const runtime = this._sessions.get(sessionId);
    if (!runtime) {
      return EMPTY;
    }
    return runtime.driverSubject.asObservable();
  }

  participants$(sessionId: string): Observable<readonly IParticipant[]> {
    const runtime = this._sessions.get(sessionId);
    if (!runtime) {
      return EMPTY;
    }
    return runtime.participantsSubject.asObservable();
  }

  register(source: IPtySource): IRegisteredPty {
    if (this._sessions.has(source.id)) {
      throw new Error(`[PtyMultiplexerService] session already registered: ${source.id}`);
    }

    const ringBuffer = new RingBuffer(SHARED_TERMINAL_RING_BUFFER_BYTES);
    const headless = new HeadlessSession({ cols: source.cols, rows: source.rows });
    const participantsSubject = new BehaviorSubject<readonly IParticipant[]>([]);
    const driverSubject = new BehaviorSubject<IDriverState>({
      sessionId: source.id,
      driverId: null,
      lastHeartbeatAt: 0,
      locked: false,
    });

    const outputSub = source.output$.subscribe({
      next: (chunk) => this._handlePtyOutput(source.id, chunk),
      error: (err) => this._logService.error(`[PtyMultiplexerService] PTY ${source.id} errored:`, err),
    });

    const runtime: ISessionRuntime = {
      source,
      ringBuffer,
      headless,
      clients: new Map(),
      participantsSubject,
      driverSubject,
      outputSub,
      driverId: null,
      driverHeartbeatAt: 0,
      driverLocked: false,
      state: SharedSessionState.Idle,
      cols: source.cols,
      rows: source.rows,
      seqCounters: {
        [FrameChannel.Control]: 0,
        [FrameChannel.PtyData]: 0,
        [FrameChannel.SessionEvent]: 0,
      },
      sessionKey: null,
    };
    this._sessions.set(source.id, runtime);
    this._publishSessions();

    return {
      sessionId: source.id,
      unregister: () => this._destroySession(source.id),
    };
  }

  async snapshot(sessionId: string): Promise<ISessionSnapshot> {
    const runtime = this._requireSession(sessionId);
    const serialized = await runtime.headless.serialize(DEFAULT_SNAPSHOT_SCROLLBACK_LINES);
    return {
      sessionId,
      title: runtime.source.title,
      cols: runtime.cols,
      rows: runtime.rows,
      serialized,
      observedSeq: runtime.seqCounters[FrameChannel.PtyData],
      state: runtime.state,
      driverId: runtime.driverId,
    };
  }

  setDriver(sessionId: string, clientId: string | null): void {
    const runtime = this._requireSession(sessionId);
    if (clientId !== null && !runtime.clients.has(clientId)) {
      throw new Error(`[PtyMultiplexerService] cannot set driver to non-attached client ${clientId}`);
    }
    if (clientId !== null) {
      const role = runtime.clients.get(clientId)!.role;
      if (!isWriterRole(role)) {
        throw new Error(`[PtyMultiplexerService] role ${role} is not allowed to be driver`);
      }
    }
    runtime.driverId = clientId;
    runtime.driverHeartbeatAt = clientId ? Date.now() : 0;
    this._publishDriver(runtime);
    this._broadcastSessionEvent(sessionId, {
      type: 'driver_handover',
      sessionId,
      fromClientId: null,
      toClientId: clientId,
    });
  }

  lockDriver(sessionId: string, clientId: string): void {
    const runtime = this._requireSession(sessionId);
    if (!runtime.clients.has(clientId)) {
      throw new Error(`[PtyMultiplexerService] cannot lock driver to non-attached client ${clientId}`);
    }
    runtime.driverId = clientId;
    runtime.driverLocked = true;
    runtime.driverHeartbeatAt = Date.now();
    this._publishDriver(runtime);
  }

  unlockDriver(sessionId: string): void {
    const runtime = this._requireSession(sessionId);
    runtime.driverLocked = false;
    this._publishDriver(runtime);
  }

  kick(sessionId: string, clientId: string, reason?: string): void {
    const runtime = this._sessions.get(sessionId);
    if (!runtime || !runtime.clients.has(clientId)) {
      return;
    }
    this._sendControlToClient(sessionId, clientId, { type: 'kick', reason });
    this._detachClientInternal(runtime, clientId, 'kick');
  }

  getSessionKey(sessionId: string): Uint8Array | null {
    const runtime = this._sessions.get(sessionId);
    return runtime?.sessionKey ?? null;
  }

  async rekey(sessionId: string, reason: RekeyReason): Promise<IRekeyResult> {
    const runtime = this._requireSession(sessionId);
    runtime.sessionKey = this._crypto.generateSessionKey();
    return this._wrapAndBroadcastSessionKey(runtime, reason);
  }

  /**
   * Generate per-recipient wrapped keys + broadcast 'rekey' control frames. Returns the
   * result envelope. Skips clients with no registered pubkey (legacy paired-device path).
   */
  private async _wrapAndBroadcastSessionKey(
    runtime: ISessionRuntime,
    reason: RekeyReason
  ): Promise<IRekeyResult> {
    const sessionKey = runtime.sessionKey;
    if (!sessionKey) {
      return {
        sessionId: runtime.source.id,
        reason,
        recipientCount: 0,
        unwrappedClientIds: [...runtime.clients.keys()],
      };
    }
    if (!this._daemonKeypair) {
      // Daemon keypair service was not registered (e.g. test harness). Nothing to broadcast.
      return {
        sessionId: runtime.source.id,
        reason,
        recipientCount: 0,
        unwrappedClientIds: [...runtime.clients.keys()],
      };
    }
    const daemon = await this._daemonKeypair.getOrCreate();
    const unwrappedClientIds: string[] = [];
    let recipientCount = 0;
    for (const [clientId, entry] of runtime.clients) {
      if (!entry.publicKey) {
        unwrappedClientIds.push(clientId);
        continue;
      }
      const wrapped = this._crypto.wrapSessionKey(sessionKey, entry.publicKey, daemon.secretKey);
      this._sendControlToClient(runtime.source.id, clientId, {
        type: 'rekey',
        wrappedKey: bytesToBase64Url(wrapped),
        senderPublicKey: bytesToBase64Url(daemon.publicKey),
        reason,
      });
      recipientCount += 1;
    }
    return {
      sessionId: runtime.source.id,
      reason,
      recipientCount,
      unwrappedClientIds,
    };
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

  private _attachClientRuntime(
    runtime: ISessionRuntime,
    clientId: string,
    role: SharedTerminalRole,
    displayName?: string,
    publicKey?: Uint8Array
  ): void {
    if (runtime.clients.has(clientId)) {
      // Re-attach: refresh role and heartbeat; keep prior pubkey unless caller supplies one.
      const existing = runtime.clients.get(clientId)!;
      runtime.clients.set(clientId, {
        role,
        displayName: displayName ?? existing.displayName,
        joinedAt: existing.joinedAt,
        lastHeartbeatAt: Date.now(),
        publicKey: publicKey ?? existing.publicKey,
      });
      this._publishParticipants(runtime);
      return;
    }

    const now = Date.now();
    runtime.clients.set(clientId, {
      role,
      displayName: displayName ?? clientId,
      joinedAt: now,
      lastHeartbeatAt: now,
      publicKey: publicKey ?? null,
    });

    // First keyed participant: generate the per-session symmetric key + wrap it for them.
    if (publicKey && runtime.sessionKey === null && this._daemonKeypair) {
      runtime.sessionKey = this._crypto.generateSessionKey();
      // Fire-and-forget: wrap+broadcast happens via rekey() so the new client receives
      // the wrapped K via the same control-frame path as future rotations.
      void this._wrapAndBroadcastSessionKey(runtime, 'manual');
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

  detachClient(sessionId: string, clientId: string): void {
    const runtime = this._sessions.get(sessionId);
    if (!runtime || !runtime.clients.has(clientId)) {
      return;
    }
    this._detachClientInternal(runtime, clientId, 'detach');
  }

  /**
   * Common detach path. Forward secrecy: if the departing client had a
   * registered pubkey (i.e. it participated in sessionKey wrapping) we rotate the key
   * so the kicked/disconnected participant cannot continue to decrypt new traffic via a
   * stale relay buffer.
   */
  private _detachClientInternal(
    runtime: ISessionRuntime,
    clientId: string,
    reason: RekeyReason
  ): void {
    const wasKeyed = Boolean(runtime.clients.get(clientId)?.publicKey);
    runtime.clients.delete(clientId);

    if (runtime.driverId === clientId) {
      runtime.driverId = null;
      runtime.driverLocked = false;
      runtime.driverHeartbeatAt = 0;
      this._publishDriver(runtime);
    }

    this._refreshRuntimeState(runtime);

    this._broadcastSessionEvent(runtime.source.id, {
      type: 'participant_left',
      sessionId: runtime.source.id,
      clientId,
    });
    this._publishParticipants(runtime);

    // Rotate session key only when (a) the leaving participant actually held a wrapped
    // copy of it AND (b) there are still keyed participants to wrap the new K for.
    if (wasKeyed && runtime.sessionKey !== null) {
      const hasRemainingKeyed = [...runtime.clients.values()].some((entry) => entry.publicKey);
      if (hasRemainingKeyed) {
        runtime.sessionKey = this._crypto.generateSessionKey();
        void this._wrapAndBroadcastSessionKey(runtime, reason);
      } else {
        // Last keyed participant left — drop the key so the next attach generates a fresh one.
        runtime.sessionKey = null;
      }
    }
  }

  handleInbound(sessionId: string, clientId: string, frame: IFrame): void {
    const runtime = this._sessions.get(sessionId);
    if (!runtime || !runtime.clients.has(clientId)) {
      return;
    }

    runtime.clients.get(clientId)!.lastHeartbeatAt = Date.now();

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
    const runtime = this._sessions.get(sessionId);
    if (!runtime || !runtime.clients.has(clientId)) {
      return;
    }
    const now = Date.now();
    runtime.clients.get(clientId)!.lastHeartbeatAt = now;
    if (runtime.driverId === clientId) {
      runtime.driverHeartbeatAt = now;
      this._publishDriver(runtime);
    }
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
    runtime.ringBuffer.write(chunk);
    runtime.headless.write(chunk);
    if (runtime.clients.size === 0) {
      return;
    }
    this._broadcast(sessionId, FrameChannel.PtyData, FrameFlag.None, chunk);
  }

  private _handleInputFrame(runtime: ISessionRuntime, clientId: string, frame: IFrame): void {
    // Only the current driver may write to the PTY.
    const client = runtime.clients.get(clientId)!;
    if (!isWriterRole(client.role)) {
      return;
    }
    if (runtime.driverId !== clientId) {
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
        this._handleDriverRequest(runtime, clientId);
        break;
      case 'driver_release':
        this._handleDriverRelease(runtime, clientId);
        break;
      case 'heartbeat':
        // Timestamp already updated above.
        break;
      case 'resize': {
        const r = parsed as { type: 'resize'; cols?: number; rows?: number };
        if (runtime.driverId === clientId && Number.isInteger(r.cols) && Number.isInteger(r.rows)) {
          const cols = r.cols!;
          const rows = r.rows!;
          try {
            runtime.source.resize(cols, rows);
            runtime.headless.resize(cols, rows);
            runtime.cols = cols;
            runtime.rows = rows;
            this._publishSessions();
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

  private _handleDriverRequest(runtime: ISessionRuntime, clientId: string): void {
    if (runtime.driverLocked && runtime.driverId !== clientId) {
      return;
    }
    const client = runtime.clients.get(clientId);
    if (!client || !isWriterRole(client.role)) {
      return;
    }
    const previous = runtime.driverId;
    runtime.driverId = clientId;
    runtime.driverHeartbeatAt = Date.now();
    this._publishDriver(runtime);
    this._broadcastSessionEvent(runtime.source.id, {
      type: 'driver_handover',
      sessionId: runtime.source.id,
      fromClientId: previous,
      toClientId: clientId,
    });
  }

  private _handleDriverRelease(runtime: ISessionRuntime, clientId: string): void {
    if (runtime.driverId !== clientId) {
      return;
    }
    runtime.driverId = null;
    runtime.driverHeartbeatAt = 0;
    this._publishDriver(runtime);
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
        driverId: runtime.driverId,
      });
    }
    this._sessionsSubject.next(out);
  }

  private _publishDriver(runtime: ISessionRuntime): void {
    runtime.driverSubject.next({
      sessionId: runtime.source.id,
      driverId: runtime.driverId,
      lastHeartbeatAt: runtime.driverHeartbeatAt,
      locked: runtime.driverLocked,
    });
    this._publishSessions();
  }

  private _publishParticipants(runtime: ISessionRuntime): void {
    const list: IParticipant[] = [];
    for (const [clientId, entry] of runtime.clients) {
      list.push({
        connectionId: clientId,
        displayName: entry.displayName,
        role: entry.role,
        joinedAt: entry.joinedAt,
        isCurrent: false, // The daemon has no notion of "current"; client UI determines this.
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
    // Notify all attached clients.
    this._broadcastSessionEvent(sessionId, { type: 'session_closed', sessionId });
    runtime.state = SharedSessionState.Closed;
    runtime.headless.dispose();
    runtime.participantsSubject.complete();
    runtime.driverSubject.complete();
    this._sessions.delete(sessionId);
    this._publishSessions();
  }

  private _refreshRuntimeState(runtime: ISessionRuntime, publish = true): void {
    if (runtime.clients.size > 0) {
      runtime.state = SharedSessionState.Active;
    } else {
      runtime.state = SharedSessionState.Idle;
    }
    if (publish) {
      this._publishSessions();
    }
  }

  private _reapStaleDrivers(): void {
    const now = Date.now();
    for (const runtime of this._sessions.values()) {
      if (runtime.driverId === null || runtime.driverLocked) {
        continue;
      }
      if (now - runtime.driverHeartbeatAt > SHARED_TERMINAL_DRIVER_HEARTBEAT_TIMEOUT_MS) {
        const previous = runtime.driverId;
        runtime.driverId = null;
        runtime.driverHeartbeatAt = 0;
        this._publishDriver(runtime);
        this._broadcastSessionEvent(runtime.source.id, {
          type: 'driver_handover',
          sessionId: runtime.source.id,
          fromClientId: previous,
          toClientId: null,
        });
      }
    }
  }
}
