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
import type { ICapability, IFrame, IFrameCodecService, IRemoteSession, ISharedTerminalCryptoService, RemoteSessionEvent } from '@termlnk/shared-terminal';
import type { Observable, Subscription } from 'rxjs';
import type { RelayTransportService } from './relay-transport.service';
import { Disposable } from '@termlnk/core';
import { FrameChannel, FrameFlag, RemoteSessionStatus, SharedTerminalRole, TransportState } from '@termlnk/shared-terminal';
import { BehaviorSubject, Subject } from 'rxjs';
import { bytesToBase64Url } from '../utils/encoding';

const HEARTBEAT_INTERVAL_MS = 5_000;

/**
 * Joiner-side single remote terminal session — structural twin of SSHSession /
 * PTYSession.
 *
 * Owns the transport, the per-channel sequence counters used for outbound
 * frames, and the joiner-side ephemeral X25519 secret (consumed once to unwrap
 * the per-session sessionKey, then cleared).
 *
 * Decodes inbound frames inside this class so the outward contract carries
 * `Uint8Array` PTY bytes on `data$` and structured `RemoteSessionEvent`s on
 * `event$`. Renderer code never sees raw frames, channels, or base64 payloads.
 */
export class RemoteSession extends Disposable implements IRemoteSession {
  private readonly _status$ = new BehaviorSubject<RemoteSessionStatus>(RemoteSessionStatus.CONNECTING);
  readonly status$: Observable<RemoteSessionStatus> = this._status$.asObservable();

  private readonly _data$ = new Subject<Uint8Array>();
  readonly data$: Observable<Uint8Array> = this._data$.asObservable();

  private readonly _event$ = new Subject<RemoteSessionEvent>();
  readonly event$: Observable<RemoteSessionEvent> = this._event$.asObservable();

  /**
   * BehaviorSubject so the UI can sync-read the current error (null when
   * healthy). Auto-cleared on a successful reconnect — without that, a single
   * transient rekey failure would stick a red badge on the tab forever.
   */
  private readonly _error$ = new BehaviorSubject<string | null>(null);
  readonly error$: Observable<string | null> = this._error$.asObservable();

  private readonly _connectionId$ = new BehaviorSubject<string | null>(null);
  readonly connectionId$: Observable<string | null> = this._connectionId$.asObservable();

  private readonly _driverId$ = new BehaviorSubject<string | null>(null);
  readonly driverId$: Observable<string | null> = this._driverId$.asObservable();

  /**
   * Merged session_metadata cache. Daemon sends partial deltas — RemoteSession
   * accumulates them here so every emission on `event$` carries the FULL
   * current view of owner-pushed metadata. Without this, a title-only delta
   * arriving after an ownerLabel-only delta would clobber the ownerLabel
   * field in the consumer's view.
   */
  private _metadataCache: { ownerLabel?: string; title?: string } = {};

  private readonly _outboundSeq: Record<FrameChannel, number> = {
    [FrameChannel.Control]: 0,
    [FrameChannel.PtyData]: 0,
    [FrameChannel.SessionEvent]: 0,
  };

  private readonly _subscriptions: Subscription[] = [];
  private _heartbeatTimer: Nullable<ReturnType<typeof setInterval>> = null;
  private _userSecretKey: Nullable<Uint8Array>;
  private _cols = 80;
  private _rows = 24;

  constructor(
    private readonly _sessionId: string,
    private readonly _transport: RelayTransportService,
    private readonly _capability: ICapability,
    private readonly _daemonPub: Uint8Array,
    userSecretKey: Uint8Array,
    private readonly _cryptoService: ISharedTerminalCryptoService,
    private readonly _codecService: IFrameCodecService,
    private readonly _logService: ILogService
  ) {
    super();
    this._userSecretKey = userSecretKey;
    this._wireTransport();
  }

  get sessionId(): string {
    return this._sessionId;
  }

  get cols(): number {
    return this._cols;
  }

  get rows(): number {
    return this._rows;
  }

  /** Used by the service right before connect to mark the lifecycle entry point. */
  markConnecting(): void {
    this._status$.next(RemoteSessionStatus.CONNECTING);
  }

  /** Used by the service after the initial `client_join` is sent. */
  startHeartbeat(): void {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      void this.sendControl({ type: 'heartbeat' });
    }, HEARTBEAT_INTERVAL_MS);
    if (typeof this._heartbeatTimer === 'object' && this._heartbeatTimer !== null && 'unref' in this._heartbeatTimer) {
      (this._heartbeatTimer as { unref: () => void }).unref();
    }
  }

  /** Used by the service to send the initial `client_join` control frame. */
  sendClientJoin(inviteId: string, userPublicKey: Uint8Array): void {
    const message = {
      type: 'client_join',
      inviteId,
      role: this._capability.role,
      userPublicKey: bytesToBase64Url(userPublicKey),
    };
    this._sendControlInternal(message);
  }

  async write(data: string | Uint8Array): Promise<void> {
    if (this._status$.getValue() !== RemoteSessionStatus.CONNECTED) {
      return;
    }
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const seq = this._nextSeq(FrameChannel.PtyData);
    try {
      this._transport.send(
        { channel: FrameChannel.PtyData, flags: FrameFlag.None, seq, payload: bytes },
        { target: 'daemon' }
      );
    } catch (err) {
      this._logService.warn(`[RemoteSession] write failed for ${this._sessionId}:`, err);
    }
  }

  async resize(_rows: number, _cols: number): Promise<void> {
    // Joiners cannot change the owner's PTY size; the owner-side snapshot is
    // authoritative for terminal dimensions. Keeping this as a method to match
    // SSHSession/PTYSession's shape; we intentionally do nothing on the wire.
  }

  async sendControl(message: object): Promise<void> {
    if (this._status$.getValue() !== RemoteSessionStatus.CONNECTED) {
      return;
    }
    this._sendControlInternal(message);
  }

  async close(): Promise<void> {
    this._stopHeartbeat();
    for (const sub of this._subscriptions) {
      sub.unsubscribe();
    }
    this._subscriptions.length = 0;
    try {
      await this._transport.disconnect();
    } catch (err) {
      this._logService.error(`[RemoteSession] transport disconnect threw for ${this._sessionId}:`, err);
    }
    this._status$.next(RemoteSessionStatus.CLOSED);
  }

  override dispose(): void {
    super.dispose();
    this._stopHeartbeat();
    for (const sub of this._subscriptions) {
      sub.unsubscribe();
    }
    this._subscriptions.length = 0;
    try {
      this._transport.dispose();
    } catch (err) {
      this._logService.warn(`[RemoteSession] transport dispose threw for ${this._sessionId}:`, err);
    }
    this._userSecretKey = null;
    this._status$.complete();
    this._data$.complete();
    this._event$.complete();
    this._error$.complete();
    this._connectionId$.complete();
    this._driverId$.complete();
  }

  private _wireTransport(): void {
    this._subscriptions.push(this._transport.state$.subscribe((state) => {
      switch (state) {
        case TransportState.Connected:
          this._status$.next(RemoteSessionStatus.CONNECTED);
          // Clear any sticky error from a previous transient failure (e.g.
          // rekey unwrap failed, then a successful reconnect). Without this
          // the BehaviorSubject keeps the stale string forever, which the
          // RemoteTabAdornment surfaces as a permanent red badge.
          if (this._error$.getValue() !== null) {
            this._error$.next(null);
          }
          break;
        case TransportState.Connecting:
        case TransportState.Reconnecting:
          this._status$.next(RemoteSessionStatus.CONNECTING);
          break;
        case TransportState.Disconnected:
          this._status$.next(RemoteSessionStatus.CLOSED);
          break;
        case TransportState.Error:
          this._status$.next(RemoteSessionStatus.ERROR);
          break;
        case TransportState.Idle:
          // Skip the seed Idle — wireTransport runs BEFORE transport.connect,
          // so the very first emission would clobber the CONNECTING state
          // we just set in the service.
          break;
      }
    }));

    this._subscriptions.push(this._transport.frames$.subscribe((inbound) => {
      const frame = inbound.frame;
      switch (frame.channel) {
        case FrameChannel.PtyData:
          this._data$.next(frame.payload);
          break;
        case FrameChannel.SessionEvent:
          this._consumeSessionEvent(frame);
          break;
        case FrameChannel.Control:
          this._consumeControlFrame(frame);
          break;
      }
    }));

    // The relay-assigned connection id is the only ID the daemon side sees for
    // this joiner (it shows up as `envelope.source` on every inbound frame),
    // so it must be the same id the UI uses to identify "me" — comparing
    // against driverId, participant ids, etc. The transport learns it from the
    // `ready` envelope after the WebSocket upgrade; we mirror it 1:1.
    this._subscriptions.push(this._transport.connectionId$.subscribe((id) => {
      this._connectionId$.next(id);
    }));

    // Terminal-domain failures from the relay are surfaced separately from
    // frame channels so the heartbeat and reconnect loop can be stopped.
    // Distinguish graceful owner-initiated end (4002 / 'owner_left') from
    // genuine failures: the former is a normal CLOSED, the latter must land
    // on ERROR so the tab adornment flags it as an error condition rather
    // than a soft close.
    this._subscriptions.push(this._transport.terminalError$.subscribe(({ code, reason }) => {
      const isOwnerLeft = code === 4002 || reason === 'owner_left';
      if (isOwnerLeft) {
        this._error$.next('owner ended the share');
        this._status$.next(RemoteSessionStatus.CLOSED);
      } else {
        this._error$.next(`relay error: ${reason}`);
        this._status$.next(RemoteSessionStatus.ERROR);
      }
      this._stopHeartbeat();
    }));
  }

  private _consumeSessionEvent(frame: IFrame): void {
    let parsed: { type?: string };
    try {
      parsed = JSON.parse(new TextDecoder().decode(frame.payload)) as { type?: string };
    } catch (err) {
      this._logService.error('[RemoteSession] session event decode failed:', err);
      return;
    }
    switch (parsed.type) {
      case 'snapshot': {
        const snap = parsed as { cols?: number; rows?: number; serialized?: string; observedSeq?: number };
        const cols = typeof snap.cols === 'number' ? snap.cols : this._cols;
        const rows = typeof snap.rows === 'number' ? snap.rows : this._rows;
        this._cols = cols;
        this._rows = rows;
        this._event$.next({
          type: 'snapshot',
          cols,
          rows,
          serialized: snap.serialized ?? '',
          observedSeq: snap.observedSeq ?? 0,
        });
        break;
      }
      case 'resize': {
        const r = parsed as { cols?: number; rows?: number };
        if (!Number.isInteger(r.cols) || !Number.isInteger(r.rows)) {
          break;
        }
        this._cols = r.cols!;
        this._rows = r.rows!;
        this._event$.next({
          type: 'resize',
          cols: this._cols,
          rows: this._rows,
        });
        break;
      }
      case 'session_metadata': {
        // Daemon sends partial deltas: `null` = "explicitly cleared", missing
        // key = "no change". Merge into our cache and emit the merged snapshot
        // so downstream consumers never have to track delta state themselves.
        const meta = parsed as { ownerLabel?: string | null; title?: string | null };
        const next: { ownerLabel?: string; title?: string } = { ...this._metadataCache };
        if ('ownerLabel' in meta) {
          if (meta.ownerLabel === null || meta.ownerLabel === undefined) {
            delete next.ownerLabel;
          } else {
            next.ownerLabel = meta.ownerLabel;
          }
        }
        if ('title' in meta) {
          if (meta.title === null || meta.title === undefined) {
            delete next.title;
          } else {
            next.title = meta.title;
          }
        }
        this._metadataCache = next;
        this._event$.next({
          type: 'session_metadata',
          ownerLabel: next.ownerLabel,
          title: next.title,
        });
        break;
      }
      case 'driver_handover': {
        const handover = parsed as { fromClientId?: string | null; toClientId?: string | null };
        this._driverId$.next(handover.toClientId ?? null);
        this._event$.next({
          type: 'driver_handover',
          fromClientId: handover.fromClientId ?? null,
          toClientId: handover.toClientId ?? null,
        });
        break;
      }
      case 'participant_joined': {
        const ev = parsed as { clientId?: string; role?: string; displayName?: string };
        if (typeof ev.clientId !== 'string' || typeof ev.role !== 'string') {
          this._logService.warn('[RemoteSession] participant_joined missing clientId/role; ignoring');
          break;
        }
        // Validate the role against the SharedTerminalRole enum at runtime —
        // the wire value comes from JSON.parse and is otherwise untrusted. An
        // unknown role would flow through as a typed enum value and could
        // mis-classify writers vs observers downstream.
        if (!isValidRole(ev.role)) {
          this._logService.warn(`[RemoteSession] participant_joined unknown role: ${ev.role}`);
          break;
        }
        this._event$.next({
          type: 'participant_joined',
          clientId: ev.clientId,
          role: ev.role,
          displayName: ev.displayName,
        });
        break;
      }
      case 'participant_left': {
        const ev = parsed as { clientId?: string };
        if (typeof ev.clientId === 'string') {
          this._event$.next({ type: 'participant_left', clientId: ev.clientId });
        }
        break;
      }
      case 'session_closed':
        this._event$.next({ type: 'session_closed' });
        this._status$.next(RemoteSessionStatus.CLOSED);
        break;
      default:
        // Unknown session events ignored for forward compatibility.
        break;
    }
  }

  private _consumeControlFrame(frame: IFrame): void {
    let message: { type?: string; wrappedKey?: string; senderPublicKey?: string; reason?: string };
    try {
      message = JSON.parse(new TextDecoder().decode(frame.payload));
    } catch (err) {
      this._logService.warn('[RemoteSession] control frame decode failed:', err);
      return;
    }
    if (message.type === 'rekey' && message.wrappedKey) {
      if (!this._userSecretKey) {
        this._logService.warn('[RemoteSession] rekey arrived without joiner secret key');
        return;
      }
      try {
        const senderPub = message.senderPublicKey
          ? base64UrlToBytes(message.senderPublicKey)
          : this._daemonPub;
        const wrapped = base64UrlToBytes(message.wrappedKey);
        const sessionKey = this._cryptoService.unwrapSessionKey(wrapped, senderPub, this._userSecretKey);
        this._transport.rekey(sessionKey).catch((err) => {
          const reason = err instanceof Error ? err.message : String(err);
          this._logService.error('[RemoteSession] transport.rekey failed:', err);
          this._error$.next(`rekey failed: ${reason}`);
          this._status$.next(RemoteSessionStatus.ERROR);
        });
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this._logService.error('[RemoteSession] rekey unwrap failed:', err);
        this._error$.next(`rekey unwrap failed: ${reason}`);
        this._status$.next(RemoteSessionStatus.ERROR);
      }
      return;
    }
    if (message.type === 'error' && typeof message.reason === 'string') {
      this._error$.next(`daemon error: ${message.reason}`);
      this._status$.next(RemoteSessionStatus.ERROR);
    }
  }

  private _sendControlInternal(message: object): void {
    const seq = this._nextSeq(FrameChannel.Control);
    const payload = new TextEncoder().encode(JSON.stringify(message));
    try {
      this._transport.send(
        { channel: FrameChannel.Control, flags: FrameFlag.None, seq, payload },
        { target: 'daemon' }
      );
    } catch (err) {
      this._logService.warn(`[RemoteSession] control send failed for ${this._sessionId}:`, err);
    }
  }

  private _nextSeq(channel: FrameChannel): number {
    const seq = this._outboundSeq[channel];
    this._outboundSeq[channel] = (seq + 1) >>> 0;
    return seq;
  }

  private _stopHeartbeat(): void {
    if (this._heartbeatTimer !== null) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }
}

function isValidRole(value: string): value is SharedTerminalRole {
  // Object.values on a string enum produces the runtime string set — matching
  // against it gives us a real boundary check rather than trusting the wire.
  return (Object.values(SharedTerminalRole) as readonly string[]).includes(value);
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? padded : padded + '='.repeat(4 - (padded.length % 4));
  const binary = atob(pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}
