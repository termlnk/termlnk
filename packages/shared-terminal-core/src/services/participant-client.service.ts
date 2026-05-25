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

import type { Nullable } from '@termlnk/core';
import type { ICapability, ICollabInviteTransportService, IFrame, IFrameCodecService, IParticipantConnectInput, IParticipantConnectResult, IParticipantFrame, IParticipantService, IParticipantSessionMetadata, IParticipantSnapshot, ISharedTerminalPluginConfig } from '@termlnk/shared-terminal';
import type { Observable, Subscription } from 'rxjs';
import { ITokenManager } from '@termlnk/auth';
import { Disposable, IConfigService, ILogService, Optional } from '@termlnk/core';
import { ClientConnectionState, FrameChannel, FrameFlag, ICollabInviteTransportService as ICollabInviteTransportServiceId, IFrameCodecService as IFrameCodecServiceId, ISharedTerminalCryptoService, SHARED_TERMINAL_PLUGIN_CONFIG_KEY, TransportState } from '@termlnk/shared-terminal';
import { BehaviorSubject, EMPTY, Subject } from 'rxjs';
import { RelayTransportService } from './relay-transport.service';
import { computeCapabilityHash } from '../utils/capability-hash';

const HEARTBEAT_INTERVAL_MS = 5_000;

interface IParticipantConnection {
  readonly sessionId: string;
  readonly transport: RelayTransportService;
  readonly subscriptions: Subscription[];
  readonly state$: BehaviorSubject<ClientConnectionState>;
  readonly frames$: Subject<IParticipantFrame>;
  readonly snapshot$: BehaviorSubject<IParticipantSnapshot | null>;
  readonly lastError$: BehaviorSubject<string | null>;
  readonly connectionId$: BehaviorSubject<string | null>;
  readonly metadata$: BehaviorSubject<IParticipantSessionMetadata | null>;
  readonly daemonPub: Uint8Array;
  userSecretKey: Nullable<Uint8Array>;
  heartbeatTimer: Nullable<ReturnType<typeof setInterval>>;
  outboundSeq: Record<FrameChannel, number>;
}

/**
 * Joiner-side orchestrator: holds N concurrent attachments to shared sessions,
 * one per sessionId. Each connection owns its own RelayTransportService socket
 * (mirroring the daemon-side pattern in ShareDaemonService), independent state
 * subjects, and an independent heartbeat timer. Disconnecting one attachment
 * never touches the others.
 *
 * Renderers consume `state$(sid) / frames$(sid) / ...` per tab. `sessions$`
 * gives the global "which sids am I attached to right now" stream that the
 * bridge controller uses to drive ITerminalUIService.addSession/removeSession.
 */
export class ParticipantClientService extends Disposable implements IParticipantService {
  private readonly _connections = new Map<string, IParticipantConnection>();

  private readonly _sessions$ = new BehaviorSubject<readonly string[]>([]);
  readonly sessions$: Observable<readonly string[]> = this._sessions$.asObservable();

  /**
   * In-flight `connect()` promises keyed by sessionId. A second call for the
   * same sid joins the existing promise instead of opening a parallel
   * transport — closes the race where two awaits between parseInviteUrl and
   * the map registration would both call `_createConnection` and leak the
   * first half-built connection.
   */
  private readonly _inflightConnects = new Map<string, Promise<IParticipantConnectResult>>();

  constructor(
    @ILogService private readonly _logService: ILogService,
    @IConfigService private readonly _configService: IConfigService,
    @ISharedTerminalCryptoService private readonly _cryptoService: ISharedTerminalCryptoService,
    @IFrameCodecServiceId private readonly _codec: IFrameCodecService,
    @Optional(ITokenManager) private readonly _tokenManager?: ITokenManager,
    @Optional(ICollabInviteTransportServiceId) private readonly _inviteTransport?: ICollabInviteTransportService
  ) {
    super();
  }

  override dispose(): void {
    super.dispose();
    for (const sessionId of [...this._connections.keys()]) {
      this._tearDown(sessionId);
    }
    this._connections.clear();
    this._inflightConnects.clear();
    this._sessions$.complete();
  }

  getSessions(): readonly string[] {
    return this._sessions$.getValue();
  }

  state$(sessionId: string): Observable<ClientConnectionState> {
    const conn = this._connections.get(sessionId);
    return conn ? conn.state$.asObservable() : EMPTY;
  }

  frames$(sessionId: string): Observable<IParticipantFrame> {
    const conn = this._connections.get(sessionId);
    return conn ? conn.frames$.asObservable() : EMPTY;
  }

  snapshot$(sessionId: string): Observable<IParticipantSnapshot | null> {
    const conn = this._connections.get(sessionId);
    return conn ? conn.snapshot$.asObservable() : EMPTY;
  }

  lastError$(sessionId: string): Observable<string | null> {
    const conn = this._connections.get(sessionId);
    return conn ? conn.lastError$.asObservable() : EMPTY;
  }

  connectionId$(sessionId: string): Observable<string | null> {
    const conn = this._connections.get(sessionId);
    return conn ? conn.connectionId$.asObservable() : EMPTY;
  }

  metadata$(sessionId: string): Observable<IParticipantSessionMetadata | null> {
    const conn = this._connections.get(sessionId);
    return conn ? conn.metadata$.asObservable() : EMPTY;
  }

  async connect(input: IParticipantConnectInput): Promise<IParticipantConnectResult> {
    const parsed = parseInviteUrl(input.inviteUrl);
    const sessionId = parsed.capability.sid;

    // Re-clicking the same invite while still connected is benign — return the
    // existing connection's identity. The renderer's join dialog stays open
    // briefly then closes; the tab is already there.
    const existing = this._connections.get(sessionId);
    if (existing) {
      const state = existing.state$.getValue();
      if (state === ClientConnectionState.Connected || state === ClientConnectionState.Connecting || state === ClientConnectionState.Pairing) {
        return {
          sessionId,
          connectionId: existing.connectionId$.getValue() ?? parsed.inviteId,
          snapshot: existing.snapshot$.getValue() ?? undefined,
        };
      }
      // Stale / errored entry — tear it down before re-attaching.
      this._tearDown(sessionId);
    }

    // Dedupe concurrent connect() calls for the same sid: the second caller
    // joins the in-flight promise instead of opening a parallel transport.
    // Without this an over-eager UI (double-click on Join, tRPC retry, deep
    // link race) would race past every check up to _registerConnection and
    // leak the first connection (its transport / heartbeat orphaned).
    const inflight = this._inflightConnects.get(sessionId);
    if (inflight) {
      return inflight;
    }
    const promise = this._performConnect(parsed);
    this._inflightConnects.set(sessionId, promise);
    try {
      return await promise;
    } finally {
      this._inflightConnects.delete(sessionId);
    }
  }

  private async _performConnect(parsed: IParsedInvite): Promise<IParticipantConnectResult> {
    const sessionId = parsed.capability.sid;

    const config = this._configService.getConfig<ISharedTerminalPluginConfig>(SHARED_TERMINAL_PLUGIN_CONFIG_KEY);
    const relayBaseUrl = config?.relayBaseUrl?.replace(/\/+$/, '');
    if (!relayBaseUrl) {
      throw new Error('shared-terminal: relayBaseUrl not configured (set ISharedTerminalPluginConfig.relayBaseUrl or deploy a relay).');
    }

    // Relay routes by (userId, sessionId); userId comes from the joiner's JWT.
    const accountToken = await this._tokenManager?.getAccessToken();
    if (!accountToken) {
      throw new Error('shared-terminal: sign in before joining a shared session — the relay requires the joiner\'s access token.');
    }

    const ephPriv = base64UrlToBytes(parsed.ephPriv);
    const daemonPub = base64UrlToBytes(parsed.capability.daemonPub);
    const sharedKey = this._cryptoService.deriveSharedKey(daemonPub, ephPriv);

    const userKp = this._cryptoService.generateKeypair();

    let claimedConnectionId: string | undefined;
    let relayClaimToken: string | undefined;
    if (this._inviteTransport) {
      try {
        const capabilityHash = await computeCapabilityHash(parsed.capability);
        const claim = await this._inviteTransport.claim(parsed.inviteId, { capabilityHash });
        claimedConnectionId = claim.connectionId;
        relayClaimToken = claim.relayClaimToken;
      } catch (err) {
        // Server might not have claim plumbed up yet (older deployments).
        this._logService.warn('[ParticipantClientService] invite claim failed; falling back to same-account attach:', err);
      }
    }

    // Build the connection (subjects + transport) but do NOT publish it on
    // _sessions$ yet — that emission is what the renderer's bridge controller
    // uses to add a tab, so publishing before the relay accepts the socket
    // would create a tab that flashes in and immediately out on connect
    // failure, with no error surface for the user.
    const conn = this._createConnection(sessionId, daemonPub);
    conn.userSecretKey = userKp.secretKey;
    conn.state$.next(ClientConnectionState.Connecting);

    // Wire transport subscriptions BEFORE transport.connect so SessionEvents
    // the daemon pushes during/right-after WS open (concurrent owner-side
    // title pushes etc.) are not dropped into a no-subscriber Subject.
    this._wireTransport(conn);

    try {
      await conn.transport.connect({
        relayBaseUrl,
        sessionId,
        accountToken,
        mode: 'client',
        connectionId: claimedConnectionId,
        relayClaimToken,
      }, sharedKey);
    } catch (err) {
      // Failure path: dispose the partially-built connection without ever
      // adding it to _connections or emitting on _sessions$. The error
      // surfaces through the rejected promise to the renderer's join dialog,
      // which already shows it inline. The bridge never sees a tab.
      this._destroyConnection(conn);
      const message = err instanceof Error ? err.message : String(err);
      this._logService.error(`[ParticipantClientService] transport connect failed for ${sessionId}: ${message}`);
      throw err;
    }

    const effectiveConnectionId = claimedConnectionId ?? parsed.inviteId;
    conn.connectionId$.next(effectiveConnectionId);

    // Publish only after the relay accepted us — the bridge controller now
    // sees the new sid and addSession()s a tab.
    this._registerConnection(conn);
    this._startHeartbeat(conn);
    this._sendClientJoin(conn, parsed, userKp.publicKey);

    return {
      sessionId,
      connectionId: effectiveConnectionId,
      snapshot: conn.snapshot$.getValue() ?? undefined,
    };
  }

  async disconnect(sessionId: string): Promise<void> {
    const conn = this._connections.get(sessionId);
    if (!conn) {
      return;
    }
    this._stopHeartbeat(conn);
    this._cleanupSubscriptions(conn);
    try {
      await conn.transport.disconnect();
    } catch (err) {
      this._logService.error(`[ParticipantClientService] transport disconnect threw for ${sessionId}:`, err);
    }
    conn.state$.next(ClientConnectionState.Disconnected);
    this._tearDown(sessionId);
  }

  async sendInput(sessionId: string, data: Uint8Array): Promise<void> {
    const conn = this._connections.get(sessionId);
    if (!conn) {
      return;
    }
    if (conn.state$.getValue() !== ClientConnectionState.Connected) {
      // No-op when not yet connected — matches the original behaviour so the
      // renderer key handler doesn't need to gate on state explicitly.
      return;
    }
    const seq = this._nextSeq(conn, FrameChannel.PtyData);
    const frame: IFrame = {
      channel: FrameChannel.PtyData,
      flags: FrameFlag.None,
      seq,
      payload: data,
    };
    try {
      conn.transport.send(frame, { target: 'daemon' });
    } catch (err) {
      this._logService.warn(`[ParticipantClientService] sendInput failed for ${sessionId}:`, err);
    }
  }

  async sendControl(sessionId: string, message: object): Promise<void> {
    const conn = this._connections.get(sessionId);
    if (!conn) {
      return;
    }
    if (conn.state$.getValue() !== ClientConnectionState.Connected) {
      return;
    }
    const seq = this._nextSeq(conn, FrameChannel.Control);
    const frame: IFrame = {
      channel: FrameChannel.Control,
      flags: FrameFlag.None,
      seq,
      payload: new TextEncoder().encode(JSON.stringify(message)),
    };
    try {
      conn.transport.send(frame, { target: 'daemon' });
    } catch (err) {
      this._logService.warn(`[ParticipantClientService] sendControl failed for ${sessionId}:`, err);
    }
  }

  private _createConnection(sessionId: string, daemonPub: Uint8Array): IParticipantConnection {
    const transport = new RelayTransportService(this._codec, this._logService);
    return {
      sessionId,
      transport,
      subscriptions: [],
      state$: new BehaviorSubject<ClientConnectionState>(ClientConnectionState.Pairing),
      frames$: new Subject<IParticipantFrame>(),
      snapshot$: new BehaviorSubject<IParticipantSnapshot | null>(null),
      lastError$: new BehaviorSubject<string | null>(null),
      connectionId$: new BehaviorSubject<string | null>(null),
      metadata$: new BehaviorSubject<IParticipantSessionMetadata | null>(null),
      daemonPub,
      userSecretKey: null,
      heartbeatTimer: null,
      outboundSeq: {
        [FrameChannel.Control]: 0,
        [FrameChannel.PtyData]: 0,
        [FrameChannel.SessionEvent]: 0,
      },
    };
  }

  /**
   * Publish a freshly-built connection: install it under its sessionId and
   * emit on `_sessions$` so the renderer's bridge controller sees the new
   * attachment and adds a tab. Must run AFTER `transport.connect` resolves so
   * we never publish a sid that ends up failing the WS handshake.
   */
  private _registerConnection(conn: IParticipantConnection): void {
    this._connections.set(conn.sessionId, conn);
    this._sessions$.next([...this._sessions$.getValue(), conn.sessionId]);
  }

  /**
   * Discard a connection that never made it to `_registerConnection`: no
   * `_sessions$` mutation, no map removal — just tear down its subjects and
   * transport. Used on connect-time failure so the renderer never observes
   * a transient sid.
   */
  private _destroyConnection(conn: IParticipantConnection): void {
    this._stopHeartbeat(conn);
    this._cleanupSubscriptions(conn);
    conn.state$.complete();
    conn.frames$.complete();
    conn.snapshot$.complete();
    conn.lastError$.complete();
    conn.connectionId$.complete();
    conn.metadata$.complete();
    try {
      conn.transport.dispose();
    } catch (err) {
      this._logService.warn(`[ParticipantClientService] transport.dispose threw during destroy for ${conn.sessionId}:`, err);
    }
    conn.userSecretKey = null;
  }

  private _wireTransport(conn: IParticipantConnection): void {
    conn.subscriptions.push(conn.transport.state$.subscribe((state) => {
      switch (state) {
        case TransportState.Connected:
          conn.state$.next(ClientConnectionState.Connected);
          // Clear a sticky error from a previous transient failure (e.g.
          // rekey failed, then a successful reconnect). Without this the
          // BehaviorSubject keeps the stale string forever, which downstream
          // UI surfaces as a permanent error indicator.
          if (conn.lastError$.getValue() !== null) {
            conn.lastError$.next(null);
          }
          break;
        case TransportState.Connecting:
        case TransportState.Reconnecting:
          conn.state$.next(ClientConnectionState.Connecting);
          break;
        case TransportState.Disconnected:
          conn.state$.next(ClientConnectionState.Disconnected);
          break;
        case TransportState.Error:
          conn.state$.next(ClientConnectionState.Error);
          break;
        case TransportState.Idle:
          // Skip the initial BehaviorSubject emission: this method subscribes
          // BEFORE `transport.connect()` to close the frames$ race window, so
          // the very first state we observe is the pre-connect Idle. Mapping
          // it to Disconnected would clobber the Pairing/Connecting state we
          // just set in `_performConnect`.
          break;
      }
    }));

    conn.subscriptions.push(conn.transport.frames$.subscribe((inbound) => {
      const frame = inbound.frame;
      if (frame.channel === FrameChannel.SessionEvent) {
        this._consumeSessionEvent(conn, frame);
      } else if (frame.channel === FrameChannel.Control) {
        this._consumeControlFrame(conn, frame);
      }
      conn.frames$.next(toClientFrame(frame));
    }));
  }

  private _consumeSessionEvent(conn: IParticipantConnection, frame: IFrame): void {
    try {
      const text = new TextDecoder().decode(frame.payload);
      const event = JSON.parse(text) as { type?: string };
      if (event.type === 'snapshot') {
        const snap = event as unknown as IParticipantSnapshot;
        conn.snapshot$.next({
          sessionId: snap.sessionId,
          cols: snap.cols,
          rows: snap.rows,
          serialized: snap.serialized,
          observedSeq: snap.observedSeq,
        });
      } else if (event.type === 'session_metadata') {
        // null = field explicitly cleared by the owner; undefined (absent
        // key) = no change. Distinguish so a sign-out wipes the cached
        // ownerLabel instead of inheriting the previous value forever.
        const meta = event as { ownerLabel?: string | null; title?: string | null };
        const previous = conn.metadata$.getValue() ?? {};
        const merged: { ownerLabel?: string; title?: string } = {
          ownerLabel: previous.ownerLabel,
          title: previous.title,
        };
        if ('ownerLabel' in meta) {
          if (meta.ownerLabel === null || meta.ownerLabel === undefined) {
            delete merged.ownerLabel;
          } else {
            merged.ownerLabel = meta.ownerLabel;
          }
        }
        if ('title' in meta) {
          if (meta.title === null || meta.title === undefined) {
            delete merged.title;
          } else {
            merged.title = meta.title;
          }
        }
        conn.metadata$.next(merged);
      }
    } catch (err) {
      this._logService.error('[ParticipantClientService] session event decode failed:', err);
    }
  }

  private _consumeControlFrame(conn: IParticipantConnection, frame: IFrame): void {
    let message: { type?: string; wrappedKey?: string; senderPublicKey?: string; reason?: string };
    try {
      message = JSON.parse(new TextDecoder().decode(frame.payload));
    } catch (err) {
      this._logService.warn('[ParticipantClientService] control frame decode failed:', err);
      return;
    }
    if (message.type === 'rekey' && message.wrappedKey) {
      if (!conn.userSecretKey) {
        this._logService.warn('[ParticipantClientService] rekey arrived without joiner secret key');
        return;
      }
      try {
        const senderPub = message.senderPublicKey
          ? base64UrlToBytes(message.senderPublicKey)
          : conn.daemonPub;
        const wrapped = base64UrlToBytes(message.wrappedKey);
        const sessionKey = this._cryptoService.unwrapSessionKey(wrapped, senderPub, conn.userSecretKey);
        conn.transport.rekey(sessionKey).catch((err) => {
          const reason = err instanceof Error ? err.message : String(err);
          this._logService.error('[ParticipantClientService] transport.rekey failed:', err);
          conn.lastError$.next(`rekey failed: ${reason}`);
          conn.state$.next(ClientConnectionState.Error);
        });
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this._logService.error('[ParticipantClientService] rekey unwrap failed:', err);
        conn.lastError$.next(`rekey unwrap failed: ${reason}`);
        conn.state$.next(ClientConnectionState.Error);
      }
      return;
    }
    if (message.type === 'error' && typeof message.reason === 'string') {
      conn.lastError$.next(`daemon error: ${message.reason}`);
      conn.state$.next(ClientConnectionState.Error);
    }
  }

  private _sendClientJoin(conn: IParticipantConnection, parsed: IParsedInvite, userPublicKey: Uint8Array): void {
    const message = {
      type: 'client_join',
      inviteId: parsed.inviteId,
      role: parsed.capability.role,
      userPublicKey: bytesToBase64Url(userPublicKey),
    };
    const seq = this._nextSeq(conn, FrameChannel.Control);
    const frame: IFrame = {
      channel: FrameChannel.Control,
      flags: FrameFlag.None,
      seq,
      payload: new TextEncoder().encode(JSON.stringify(message)),
    };
    try {
      conn.transport.send(frame, { target: 'daemon' });
    } catch (err) {
      this._logService.warn('[ParticipantClientService] client_join send failed:', err);
    }
  }

  private _nextSeq(conn: IParticipantConnection, channel: FrameChannel): number {
    const seq = conn.outboundSeq[channel];
    conn.outboundSeq[channel] = (seq + 1) >>> 0;
    return seq;
  }

  /**
   * Periodic heartbeat upstream. The relay does not notify the daemon when
   * this joiner's WebSocket closes; without these heartbeats, mux on the
   * owner side would keep a stale `client` entry forever and the forward-
   * secrecy detach-rekey would never fire when the joiner actually leaves.
   */
  private _startHeartbeat(conn: IParticipantConnection): void {
    this._stopHeartbeat(conn);
    conn.heartbeatTimer = setInterval(() => {
      void this.sendControl(conn.sessionId, { type: 'heartbeat' });
    }, HEARTBEAT_INTERVAL_MS);
    if (typeof conn.heartbeatTimer === 'object' && conn.heartbeatTimer !== null && 'unref' in conn.heartbeatTimer) {
      (conn.heartbeatTimer as { unref: () => void }).unref();
    }
  }

  private _stopHeartbeat(conn: IParticipantConnection): void {
    if (conn.heartbeatTimer !== null) {
      clearInterval(conn.heartbeatTimer);
      conn.heartbeatTimer = null;
    }
  }

  private _cleanupSubscriptions(conn: IParticipantConnection): void {
    for (const sub of conn.subscriptions) {
      sub.unsubscribe();
    }
    conn.subscriptions.length = 0;
  }

  private _tearDown(sessionId: string): void {
    const conn = this._connections.get(sessionId);
    if (!conn) {
      return;
    }
    this._stopHeartbeat(conn);
    this._cleanupSubscriptions(conn);
    conn.state$.complete();
    conn.frames$.complete();
    conn.snapshot$.complete();
    conn.lastError$.complete();
    conn.connectionId$.complete();
    conn.metadata$.complete();
    try {
      conn.transport.dispose();
    } catch (err) {
      this._logService.warn(`[ParticipantClientService] transport.dispose threw for ${sessionId}:`, err);
    }
    // Drop the joiner's X25519 secret right after the transport closes —
    // matches the lifetime contract "secret lives only for this connection".
    conn.userSecretKey = null;
    this._connections.delete(sessionId);
    this._sessions$.next(this._sessions$.getValue().filter((sid) => sid !== sessionId));
  }
}

interface IParsedInvite {
  readonly inviteId: string;
  readonly ephPriv: string;
  readonly capability: ICapability;
}

function parseInviteUrl(url: string): IParsedInvite {
  const hashIdx = url.indexOf('#');
  if (hashIdx < 0) {
    throw new Error('invite URL is missing the fragment payload');
  }
  const fragment = decodeURIComponent(url.slice(hashIdx + 1));
  const parsed = JSON.parse(fragment) as { ephPriv?: string; capability?: ICapability };
  if (!parsed.ephPriv || !parsed.capability) {
    throw new Error('invite fragment missing ephPriv or capability');
  }
  const pathMatch = url.match(/\/(?:s|invite)\/([\w_-]+)/);
  if (!pathMatch) {
    throw new Error('invite URL is missing the /s/<id> or /invite/<id> path segment');
  }
  return {
    inviteId: pathMatch[1]!,
    ephPriv: parsed.ephPriv,
    capability: parsed.capability,
  };
}

function toClientFrame(frame: IFrame): IParticipantFrame {
  return {
    channel: frame.channel,
    payloadBase64: bytesToBase64Url(frame.payload),
    seq: frame.seq,
  };
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

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
