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
import type { IFrame, IInboundFrame, ISharedKey, ISharedTerminalTransportService, ITransportConnectOptions, ITransportSendOptions } from '@termlnk/shared-terminal';
import type { Observable } from 'rxjs';
import { Disposable, ILogService } from '@termlnk/core';
import { IFrameCodecService, TransportState } from '@termlnk/shared-terminal';
import { BehaviorSubject, Subject } from 'rxjs';

// RTCPeerConnection / RTCSessionDescriptionInit / RTCIceCandidateInit are
// declared loosely so this module compiles in Node main process as well
// (where @roamhq/wrtc provides the polyfill). We only depend on the subset
// of the W3C interface that we actually use.
declare const RTCPeerConnection: { new (config?: any): IPeerConnection } | undefined;

interface IRTCSessionDescriptionInit {
  type: string;
  sdp?: string;
}

interface IRTCIceCandidateInit {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

interface IRTCDataChannel {
  readyState: string;
  binaryType: string;
  bufferedAmount: number;
  send: (data: Uint8Array | string) => void;
  close: () => void;
  onopen: ((evt: any) => void) | null;
  onmessage: ((evt: { data: any }) => void) | null;
  onclose: ((evt: any) => void) | null;
  onerror: ((evt: any) => void) | null;
}

interface IPeerConnection {
  createDataChannel: (label: string, init?: any) => IRTCDataChannel;
  createOffer: () => Promise<IRTCSessionDescriptionInit>;
  createAnswer: () => Promise<IRTCSessionDescriptionInit>;
  setLocalDescription: (desc: IRTCSessionDescriptionInit) => Promise<void>;
  setRemoteDescription: (desc: IRTCSessionDescriptionInit) => Promise<void>;
  addIceCandidate: (cand: IRTCIceCandidateInit) => Promise<void>;
  close: () => void;
  onicecandidate: ((evt: { candidate: IRTCIceCandidateInit | null }) => void) | null;
  ondatachannel: ((evt: { channel: IRTCDataChannel }) => void) | null;
  oniceconnectionstatechange: ((evt: any) => void) | null;
  iceConnectionState: string;
}

interface ISignalEnvelope {
  type: 'hello' | 'offer' | 'answer' | 'ice' | 'bye';
  from?: string;
  to?: string;
  payload?: string; // base64url-encoded JSON for SDP / ICE
}

interface IReadyMessage {
  type: 'ready';
  peerId: string;
  peers: string[];
  iceServers?: Array<{ urls: string | string[]; username?: string; credential?: string }>;
}

/** WebRTC signaling channel constants matching the server's `/v1/multiplayer/signal`. */
const DATA_CHANNEL_LABEL = 'tmst1';

/**
 * Per-remote-peer leg of the WebRTC mesh.
 *
 * Each joiner that's online for a given session has its own RTCPeerConnection +
 * DataChannel on the daemon. Multi-joiner fan-out is the natural broadcast:
 * `send({target:'broadcast'})` walks every entry and writes the same encrypted
 * wire bytes; `send({target:<peerId>})` writes to one. The relay-mode envelope
 * `target: 'daemon'` (from joiners) is irrelevant here because each leg's
 * remote IS the daemon's view of one peer.
 */
interface IPeerLeg {
  readonly peerId: string;
  readonly pc: IPeerConnection;
  channel: IRTCDataChannel | null;
  readonly pendingIce: IRTCIceCandidateInit[];
  remoteDescriptionSet: boolean;
}

declare const WebSocket: { new (url: string, protocols?: string | string[]): IRelayWebSocket } | undefined;
interface IRelayWebSocket {
  readyState: number;
  send: (data: string | Uint8Array) => void;
  close: (code?: number, reason?: string) => void;
  addEventListener: (type: string, listener: (event: any) => void) => void;
}

/**
 * WebRTC transport.
 *
 * Lifecycle (daemon side):
 *   1. `connect()` opens a WS to `/v1/multiplayer/signal?sessionId&peerId`
 *      using the joiner's JWT as the Bearer subprotocol.
 *   2. Server sends `ready` with our peerId + the list of peers ALREADY on the
 *      session + the ICE server list. Daemon uses these ICE servers; we record
 *      our own peerId for envelope `from` and create one IPeerLeg per remote.
 *   3. For each remote peer the daemon plays the *callee* role — it waits for
 *      an `offer` from the joiner, replies with `answer`, trickles ICE.
 *
 * Lifecycle (client side):
 *   1. Same WS open + `ready`.
 *   2. Joiner is the *caller*: it picks the FIRST peer in `peers[]` (i.e. the
 *      daemon), creates a RTCPeerConnection + DataChannel(label='tmst1'),
 *      generates an offer, sends it; receives answer; trickles ICE.
 *   3. On `datachannel.open` → state$ = Connected; outbound `send(frame)`
 *      encrypts via _currentKey and pushes onto the DataChannel.
 *
 * Frame format on DataChannel: identical to the relay wire — `tmst1:`(6) +
 * nonce(24) + secretbox(plaintext). Encryption identical so `frames$` is
 * indistinguishable from the relay's. Application-layer E2EE is preserved
 * even though DTLS already encrypts the channel.
 *
 * Failure semantics: any negotiation error or DataChannel close before open
 * rejects `connect()` so CompositeTransportService can fall back to relay.
 */
export class WebRTCTransportService extends Disposable implements ISharedTerminalTransportService {
  private readonly _state$ = new BehaviorSubject<TransportState>(TransportState.Idle);
  readonly state$: Observable<TransportState> = this._state$.asObservable();

  private readonly _frames$ = new Subject<IInboundFrame>();
  readonly frames$: Observable<IInboundFrame> = this._frames$.asObservable();

  /** All currently negotiated peer legs, keyed by remote peerId. */
  private readonly _legs = new Map<string, IPeerLeg>();
  private _ws: Nullable<IRelayWebSocket> = null;
  private _myPeerId: Nullable<string> = null;
  private _iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [];
  private _sharedKey: Nullable<ISharedKey> = null;
  private _sessionKey: Nullable<ISharedKey> = null;
  private _options: Nullable<ITransportConnectOptions> = null;
  private _readyResolver: Nullable<{ resolve: () => void; reject: (err: Error) => void }> = null;

  constructor(
    @IFrameCodecService private readonly _codecService: IFrameCodecService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  override dispose(): void {
    super.dispose();
    this._teardown();
    this._state$.complete();
    this._frames$.complete();
  }

  /**
   * Whether the runtime exposes RTCPeerConnection. Renderer = always true
   * (Chromium); main process = only when @roamhq/wrtc is installed and
   * polyfills the global. Used by CompositeTransportService to decide
   * whether attempting WebRTC is worth the bother.
   */
  isSupported(): boolean {
    return typeof RTCPeerConnection !== 'undefined' && typeof WebSocket !== 'undefined';
  }

  async connect(options: ITransportConnectOptions, sharedKey: ISharedKey): Promise<void> {
    this._options = options;
    this._sharedKey = sharedKey;
    if (!this.isSupported()) {
      this._state$.next(TransportState.Error);
      throw new Error('[WebRTCTransportService] RTCPeerConnection / WebSocket unavailable in this runtime');
    }
    this._state$.next(TransportState.Connecting);
    try {
      await this._negotiate(options);
    } catch (err) {
      this._state$.next(TransportState.Error);
      this._logService.warn('[WebRTCTransportService] negotiate failed:', err);
      this._teardown();
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this._teardown();
    this._state$.next(TransportState.Disconnected);
  }

  send(frame: IFrame, options: ITransportSendOptions): void {
    if (this._state$.getValue() !== TransportState.Connected) {
      throw new Error('[WebRTCTransportService] not connected — cannot send');
    }
    const key = this._sessionKey ?? this._sharedKey;
    if (!key) {
      throw new Error('[WebRTCTransportService] no encryption key set');
    }
    const wire = this._codecService.encrypt(frame, key);
    if (options.target === 'broadcast' || options.target === 'daemon' || !options.target) {
      // Fan-out: daemon broadcasts to every connected joiner; joiner has only
      // one leg (the daemon) and target='daemon' is functionally identical.
      for (const leg of this._legs.values()) {
        this._writeToChannel(leg, wire);
      }
    } else {
      // Targeted: pick the specific peer leg.
      const leg = this._legs.get(options.target);
      if (leg) {
        this._writeToChannel(leg, wire);
      } else {
        // Unknown target: silently drop. Mirrors relay behaviour.
      }
    }
  }

  async rekey(newSessionKey: Uint8Array): Promise<void> {
    if (this._options?.mode !== 'daemon') {
      throw new Error('[WebRTCTransportService] rekey is only available in daemon mode');
    }
    this._sessionKey = { bytes: new Uint8Array(newSessionKey) };
  }

  async revokeConnection(connectionId: string): Promise<void> {
    if (this._options?.mode !== 'daemon') {
      throw new Error('[WebRTCTransportService] revokeConnection is only available in daemon mode');
    }
    // Close the offending peer leg outright; the joiner will see DataChannel
    // close and the renderer's ParticipantClient will retry through composite.
    const leg = this._legs.get(connectionId);
    if (leg) {
      try {
        leg.pc.close();
      } catch {
        // ignore — already-closed connections throw on some implementations.
      }
      this._legs.delete(connectionId);
    }
  }

  // ---------------------------------------------------------------------------
  // Negotiation
  // ---------------------------------------------------------------------------

  private async _negotiate(options: ITransportConnectOptions): Promise<void> {
    // Step 1: open the signaling WebSocket. Auth via Bearer subprotocol; the
    // relay-base URL is the cloud origin (`wss://cloud.termlnk.com/v1`) which
    // also hosts the signaling endpoint at `/v1/multiplayer/signal`.
    const myPeerId = base64UrlRandom(16);
    this._myPeerId = myPeerId;
    const ws = await this._openSignalingSocket(options, myPeerId);
    this._ws = ws;

    // Step 2: wait for `ready` from server (peerId echo + peer list + ICE servers).
    const ready = await this._awaitReady(ws);
    this._iceServers = ready.iceServers ?? [];

    // Step 3: role depends on whether anyone was already on the channel.
    //   - daemon ("share owner") joins FIRST → other peers' offers will arrive
    //     async; we play CALLEE per peer.
    //   - client (joiner) joins LATER → we pick the daemon (first peer) and
    //     play CALLER ourselves to initiate.
    if (ready.peers.length === 0) {
      // Nobody else here yet (daemon-first or sole-peer case). Stay in Connecting
      // until either a peer connects (we get an offer) OR the caller times out
      // upstream. CompositeTransportService's 5s WebRTC timeout will reap us.
      this._installPassiveListeners(ws);
      // For daemon mode this is the steady-state — we return successfully so
      // CompositeTransportService treats WebRTC as "ready for joiners"; the
      // FIRST actual DataChannel.open flips state$ → Connected.
      // For client mode this is a misconfiguration (no daemon present yet);
      // surface as a connect failure so the composite can fall back.
      if (options.mode === 'client') {
        throw new Error('[WebRTCTransportService] no daemon peer on signaling channel — cannot establish');
      }
      this._state$.next(TransportState.Connected);
      return;
    }

    this._installPassiveListeners(ws);
    if (options.mode === 'daemon') {
      // Multiple peers may already be here from a prior reconnect race.
      // Initiate a call to each so the channel is bidirectional.
      for (const remoteId of ready.peers) {
        await this._initiateCall(remoteId);
      }
    } else {
      // Joiner: only the daemon should be on the channel; if multiple peers
      // are listed (server bug?) we pick the first one.
      const daemonPeerId = ready.peers[0]!;
      await this._initiateCall(daemonPeerId);
    }
  }

  private async _openSignalingSocket(options: ITransportConnectOptions, myPeerId: string): Promise<IRelayWebSocket> {
    // The shared-terminal relay base is `<host>/v1`; the signaling endpoint
    // lives under the same versioned prefix at `/v1/multiplayer/signal`.
    const base = options.relayBaseUrl.replace(/\/+$/, '');
    const url = new URL(`${base}/multiplayer/signal`);
    url.searchParams.set('sessionId', options.sessionId);
    url.searchParams.set('peerId', myPeerId);

    const protocols = [`Bearer.${options.accountToken}`];
    const ws = new WebSocket!(url.toString(), protocols);
    return await new Promise<IRelayWebSocket>((resolve, reject) => {
      let settled = false;
      ws.addEventListener('open', () => {
        if (settled) return;
        settled = true;
        resolve(ws);
      });
      ws.addEventListener('close', () => {
        if (settled) return;
        settled = true;
        reject(new Error('[WebRTCTransportService] signaling WebSocket closed before open'));
      });
      ws.addEventListener('error', (evt) => {
        this._logService.warn('[WebRTCTransportService] signaling WS error:', evt);
      });
    });
  }

  private _awaitReady(ws: IRelayWebSocket): Promise<IReadyMessage> {
    return new Promise<IReadyMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('[WebRTCTransportService] timed out waiting for signaling ready'));
      }, 5_000);
      const onMessage = (evt: any) => {
        try {
          const data = typeof evt.data === 'string' ? evt.data : new TextDecoder().decode(evt.data);
          const parsed = JSON.parse(data) as IReadyMessage;
          if (parsed.type === 'ready') {
            clearTimeout(timer);
            resolve(parsed);
          }
        } catch (err) {
          this._logService.warn('[WebRTCTransportService] failed to parse ready envelope:', err);
        }
      };
      ws.addEventListener('message', onMessage);
    });
  }

  private _installPassiveListeners(ws: IRelayWebSocket): void {
    ws.addEventListener('message', (evt) => {
      let data: string;
      try {
        data = typeof evt.data === 'string' ? evt.data : new TextDecoder().decode(evt.data);
      } catch {
        return;
      }
      let envelope: ISignalEnvelope;
      try {
        envelope = JSON.parse(data) as ISignalEnvelope;
      } catch {
        return;
      }
      if (!envelope.type || !envelope.from || envelope.from === this._myPeerId) {
        return;
      }
      void this._dispatchSignal(envelope).catch((err) => {
        this._logService.warn('[WebRTCTransportService] signal dispatch failed:', err);
      });
    });
    ws.addEventListener('close', () => {
      // Signaling channel went away; existing PeerConnections remain alive
      // (they're P2P after handshake), but new joiners can't reach us.
      this._ws = null;
    });
  }

  private async _dispatchSignal(envelope: ISignalEnvelope): Promise<void> {
    const fromPeer = envelope.from!;
    if (envelope.type === 'bye') {
      const leg = this._legs.get(fromPeer);
      if (leg) {
        try {
          leg.pc.close();
        } catch {
          // ignore — already-closed peer connections throw on some impls
        }
        this._legs.delete(fromPeer);
      }
      return;
    }
    if (envelope.type === 'offer') {
      // Daemon-side: a new joiner is initiating. Answer it.
      const sdp = decodePayload(envelope.payload) as IRTCSessionDescriptionInit;
      let leg = this._legs.get(fromPeer);
      if (!leg) {
        leg = this._createPeerLeg(fromPeer);
      }
      await leg.pc.setRemoteDescription(sdp);
      leg.remoteDescriptionSet = true;
      // Drain any ICE we buffered before the remote description landed.
      for (const cand of leg.pendingIce) {
        try {
          await leg.pc.addIceCandidate(cand);
        } catch {
          // ignore — ICE candidate buffered before remote desc may race; relay is fine.
        }
      }
      leg.pendingIce.length = 0;
      const answer = await leg.pc.createAnswer();
      await leg.pc.setLocalDescription(answer);
      this._sendSignal({ type: 'answer', to: fromPeer, payload: encodePayload(answer) });
      return;
    }
    if (envelope.type === 'answer') {
      // We initiated; finish setting up.
      const leg = this._legs.get(fromPeer);
      if (!leg) {
        return;
      }
      const sdp = decodePayload(envelope.payload) as IRTCSessionDescriptionInit;
      await leg.pc.setRemoteDescription(sdp);
      leg.remoteDescriptionSet = true;
      for (const cand of leg.pendingIce) {
        try {
          await leg.pc.addIceCandidate(cand);
        } catch {
          // ignore
        }
      }
      leg.pendingIce.length = 0;
      return;
    }
    if (envelope.type === 'ice') {
      const leg = this._legs.get(fromPeer);
      if (!leg) {
        return;
      }
      const cand = decodePayload(envelope.payload) as IRTCIceCandidateInit;
      if (!leg.remoteDescriptionSet) {
        // Buffer until we have the remote description; addIceCandidate before
        // setRemoteDescription throws on most implementations.
        leg.pendingIce.push(cand);
      } else {
        try {
          await leg.pc.addIceCandidate(cand);
        } catch {
          // ignore
        }
      }
    }
  }

  private async _initiateCall(remotePeerId: string): Promise<void> {
    const leg = this._createPeerLeg(remotePeerId);
    // Caller side opens the DataChannel; callee receives it via ondatachannel.
    const channel = leg.pc.createDataChannel(DATA_CHANNEL_LABEL, { ordered: true });
    this._attachChannel(leg, channel);
    const offer = await leg.pc.createOffer();
    await leg.pc.setLocalDescription(offer);
    this._sendSignal({ type: 'offer', to: remotePeerId, payload: encodePayload(offer) });
  }

  private _createPeerLeg(remotePeerId: string): IPeerLeg {
    const existing = this._legs.get(remotePeerId);
    if (existing) {
      return existing;
    }
    const pc = new RTCPeerConnection!({ iceServers: this._iceServers });
    const leg: IPeerLeg = {
      peerId: remotePeerId,
      pc,
      channel: null,
      pendingIce: [],
      remoteDescriptionSet: false,
    };
    pc.onicecandidate = (evt) => {
      if (!evt.candidate) {
        return; // End-of-candidates marker; nothing to forward.
      }
      this._sendSignal({ type: 'ice', to: remotePeerId, payload: encodePayload(evt.candidate) });
    };
    pc.ondatachannel = (evt) => {
      // Callee path — the caller created the channel, we receive it here.
      this._attachChannel(leg, evt.channel);
    };
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      if (s === 'failed' || s === 'closed') {
        this._legs.delete(remotePeerId);
        if (this._legs.size === 0 && this._state$.getValue() === TransportState.Connected) {
          this._state$.next(TransportState.Disconnected);
        }
      }
    };
    this._legs.set(remotePeerId, leg);
    return leg;
  }

  private _attachChannel(leg: IPeerLeg, channel: IRTCDataChannel): void {
    channel.binaryType = 'arraybuffer';
    leg.channel = channel;
    channel.onopen = () => {
      if (this._state$.getValue() !== TransportState.Connected) {
        this._state$.next(TransportState.Connected);
      }
    };
    channel.onmessage = (evt) => {
      const data: unknown = evt.data;
      const bytes = data instanceof Uint8Array
        ? data
        : (data instanceof ArrayBuffer ? new Uint8Array(data) : null);
      if (!bytes) {
        return;
      }
      const key = this._sessionKey ?? this._sharedKey;
      if (!key) {
        return;
      }
      try {
        const frame = this._codecService.decrypt(bytes, key);
        this._frames$.next({ source: leg.peerId, frame });
      } catch (err) {
        this._logService.warn('[WebRTCTransportService] DataChannel decrypt failed:', err);
      }
    };
    channel.onclose = () => {
      // Peer leg closed; remove from registry. Composite handles fallback.
      leg.channel = null;
      this._legs.delete(leg.peerId);
      if (this._legs.size === 0 && this._state$.getValue() === TransportState.Connected) {
        this._state$.next(TransportState.Disconnected);
      }
    };
    channel.onerror = (evt) => {
      this._logService.warn(`[WebRTCTransportService] DataChannel error on leg ${leg.peerId}:`, evt);
    };
  }

  private _writeToChannel(leg: IPeerLeg, wire: Uint8Array): void {
    const ch = leg.channel;
    if (!ch || ch.readyState !== 'open') {
      return;
    }
    try {
      ch.send(wire);
    } catch (err) {
      this._logService.warn(`[WebRTCTransportService] channel.send failed for ${leg.peerId}:`, err);
    }
  }

  private _sendSignal(envelope: Omit<ISignalEnvelope, 'from'>): void {
    if (!this._ws || this._ws.readyState !== 1) {
      return;
    }
    try {
      this._ws.send(JSON.stringify({ ...envelope, from: this._myPeerId }));
    } catch (err) {
      this._logService.warn('[WebRTCTransportService] signal send failed:', err);
    }
  }

  private _teardown(): void {
    for (const leg of this._legs.values()) {
      try {
        leg.pc.close();
      } catch {
        // ignore
      }
    }
    this._legs.clear();
    if (this._ws) {
      try {
        this._ws.close(1000, 'client_disconnect');
      } catch {
        // ignore
      }
      this._ws = null;
    }
    this._myPeerId = null;
    if (this._readyResolver) {
      this._readyResolver = null;
    }
  }
}

function encodePayload(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

function decodePayload(payload: string | undefined): unknown {
  if (!payload) {
    return null;
  }
  const bytes = base64UrlDecode(payload);
  return JSON.parse(new TextDecoder().decode(bytes));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return globalThis.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? padded : padded + '='.repeat(4 - (padded.length % 4));
  const binary = globalThis.atob(pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function base64UrlRandom(byteLen: number): string {
  const bytes = new Uint8Array(byteLen);
  globalThis.crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}
