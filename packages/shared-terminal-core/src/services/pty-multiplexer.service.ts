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

import type {
  IDriverState,
  IFrame,
  IOutboundFrame,
  IParticipant,
  IPtyMultiplexerService,
  IPtySource,
  IRegisteredPty,
  ISessionSnapshot,
  ISharedSession,

  SharedTerminalRole,
} from '@termlnk/shared-terminal';
import type { Subscription } from 'rxjs';
import { Disposable, ILogService } from '@termlnk/core';
import {
  FrameChannel,
  FrameFlag,
  isWriterRole,
  SHARED_TERMINAL_DRIVER_HEARTBEAT_TIMEOUT_MS,
  SHARED_TERMINAL_RING_BUFFER_BYTES,
  SharedSessionState,
} from '@termlnk/shared-terminal';
import { BehaviorSubject, Subject } from 'rxjs';
import { HeadlessSession } from '../utils/headless-session';
import { RingBuffer } from '../utils/ring-buffer';

/** 默认 snapshot 包含的 scrollback 行数——平衡保真度与帧体积。 */
const DEFAULT_SNAPSHOT_SCROLLBACK_LINES = 1000;

/**
 * 单个 session 的运行时状态。
 */
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
  recording: boolean;
}

interface IClientEntry {
  readonly role: SharedTerminalRole;
  readonly displayName: string;
  readonly joinedAt: number;
  lastHeartbeatAt: number;
}

/**
 * PTY 多路复用器主进程实现。
 *
 * 设计依据：cloud-sync-architecture.md §5.3 + §5.7（多用户协作扩展）。
 *
 * 关键不变量：
 * - PTY 输出 fan-out 给所有 attached client（PtyData 通道，target='broadcast'）
 * - PTY 输出同时写 ring buffer——client attach 时一次性补齐 raw scrollback
 * - 仅 driver clientId 的入站 PtyData 帧会写到底层 PTY；其他被静默忽略
 * - Driver 心跳超时（5s）自动 setDriver(null)，UI 上其他 writer 可抢占
 * - Frame seq 在每个通道独立单调递增（uint32 wrap-around 走 modulo）
 *
 * **xterm-headless 集成（P5.2c 落地）**：每 session 维护一个 @xterm/headless Terminal
 * 实例和 SerializeAddon；PTY 输出同时喂给 ring buffer（raw 字节）和 headless（语义 state）。
 * snapshot() 通过 SerializeAddon 输出 ANSI 重放序列，客户端 xterm.js 直接 write 即可
 * 复原完整状态（光标 / SGR / alt-buffer / scrollback）。
 */
export class PtyMultiplexerService extends Disposable implements IPtyMultiplexerService {
  private readonly _sessions = new Map<string, ISessionRuntime>();
  private readonly _sessionsSubject = new BehaviorSubject<readonly ISharedSession[]>([]);
  private readonly _outboundSubject = new Subject<IOutboundFrame>();

  readonly sessions$ = this._sessionsSubject.asObservable();
  readonly outbound$ = this._outboundSubject.asObservable();

  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @ILogService private readonly _logService: ILogService
  ) {
    super();
    // Driver heartbeat 监控——每秒扫描一次，超时清空 driver。
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

  driverState$(sessionId: string) {
    const runtime = this._requireSession(sessionId);
    return runtime.driverSubject.asObservable();
  }

  participants$(sessionId: string) {
    const runtime = this._requireSession(sessionId);
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
      recording: false,
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
    this.detachClient(sessionId, clientId);
  }

  attachClient(
    sessionId: string,
    clientId: string,
    role: SharedTerminalRole,
    displayName?: string
  ): void {
    const runtime = this._requireSession(sessionId);
    if (runtime.clients.has(clientId)) {
      // idempotent — refresh role + heartbeat
      const existing = runtime.clients.get(clientId)!;
      runtime.clients.set(clientId, {
        role,
        displayName: displayName ?? existing.displayName,
        joinedAt: existing.joinedAt,
        lastHeartbeatAt: Date.now(),
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
    });

    if (runtime.state === SharedSessionState.Idle) {
      runtime.state = SharedSessionState.Active;
      this._publishSessions();
    }

    // 1) snapshot 单播给新加入者
    this._sendSnapshot(sessionId, clientId).catch((err) => {
      this._logService.error(`[PtyMultiplexerService] snapshot to ${clientId} failed:`, err);
    });
    // 2) participant_joined 广播给全员（含新加入者，让他知道自己已加入）
    this._broadcastSessionEvent(sessionId, {
      type: 'participant_joined',
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
    runtime.clients.delete(clientId);

    if (runtime.driverId === clientId) {
      runtime.driverId = null;
      runtime.driverLocked = false;
      runtime.driverHeartbeatAt = 0;
      this._publishDriver(runtime);
    }

    if (runtime.clients.size === 0 && runtime.state === SharedSessionState.Active) {
      runtime.state = SharedSessionState.Idle;
      this._publishSessions();
    }

    this._broadcastSessionEvent(sessionId, {
      type: 'participant_left',
      clientId,
    });
    this._publishParticipants(runtime);
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
        // client → owner 不应发 session event；忽略防伪造
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

  // ---------- internal helpers ----------

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
    // 协议层接受所有 writer 字节；UI 层在 client 端按 driver 标记决定是否实际发送。
    // 但 daemon 这一道关：必须是 writer + 必须是 driver（防止 UI bug 误发）。
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
        // already updated lastHeartbeatAt above
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
        // 未知 type 忽略——向后兼容铁律
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
        recording: runtime.recording,
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
        isCurrent: false, // daemon 视角下没有"当前"概念；客户端 UI 自己判定
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
    // 通知所有 attached clients 会话已关闭
    this._broadcastSessionEvent(sessionId, { type: 'session_closed' });
    runtime.state = SharedSessionState.Closed;
    runtime.headless.dispose();
    runtime.participantsSubject.complete();
    runtime.driverSubject.complete();
    this._sessions.delete(sessionId);
    this._publishSessions();
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
