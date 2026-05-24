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
import type { ICapability, ICollabInviteTransportService, IFrame, IParticipantConnectInput, IParticipantConnectResult, IParticipantFrame, IParticipantService, IParticipantSnapshot, ISharedTerminalPluginConfig } from '@termlnk/shared-terminal';
import type { Observable, Subscription } from 'rxjs';
import { ITokenManager } from '@termlnk/auth';
import { Disposable, IConfigService, ILogService, Optional } from '@termlnk/core';
import { ClientConnectionState, FrameChannel, FrameFlag, ICollabInviteTransportService as ICollabInviteTransportServiceId, ISharedTerminalCryptoService, ISharedTerminalTransportService, SHARED_TERMINAL_PLUGIN_CONFIG_KEY, TransportState } from '@termlnk/shared-terminal';
import { BehaviorSubject, Subject } from 'rxjs';
import { computeCapabilityHash } from '../utils/capability-hash';

/**
 * Joiner-side orchestrator: parses an invite URL, derives the shared key with the
 * relay/peer, and streams inbound frames to the renderer.
 *
 * Lives in the main process so it can hold the shared key + transport socket
 * without exposing them to the renderer. The renderer consumes `state$ + frames$`
 * via the tRPC multiplayer router.
 *
 * NOTE (M4b): connecting actually establishes the relay socket using the existing
 * ISharedTerminalTransportService. Without a deployed relay (M5 prerequisite) the
 * transport will surface a connection error on `state$`; the renderer's
 * RemoteTerminalView shows that to the user. Once the relay is reachable this
 * service stays unchanged.
 */
export class ParticipantClientService extends Disposable implements IParticipantService {
  private readonly _state$ = new BehaviorSubject<ClientConnectionState>(ClientConnectionState.Idle);
  readonly state$: Observable<ClientConnectionState> = this._state$.asObservable();

  private readonly _frames$ = new Subject<IParticipantFrame>();
  readonly frames$: Observable<IParticipantFrame> = this._frames$.asObservable();

  private readonly _snapshot$ = new BehaviorSubject<IParticipantSnapshot | null>(null);
  readonly snapshot$: Observable<IParticipantSnapshot | null> = this._snapshot$.asObservable();

  private readonly _lastError$ = new BehaviorSubject<string | null>(null);
  readonly lastError$: Observable<string | null> = this._lastError$.asObservable();

  /**
   * Server-assigned connectionId for the current participant attach (or null
   * when idle/disconnected). The renderer compares this against
   * `driverState.driverId` to figure out whether THIS client is currently the
   * driver — relying on broadcast `participant_joined` events to learn one's
   * own id race-y when multiple joiners arrive close together.
   */
  private readonly _currentConnectionId$ = new BehaviorSubject<string | null>(null);
  readonly currentConnectionId$: Observable<string | null> = this._currentConnectionId$.asObservable();

  /** SessionId of the currently joined shared session. */
  private readonly _currentSessionId$ = new BehaviorSubject<string | null>(null);
  readonly currentSessionId$: Observable<string | null> = this._currentSessionId$.asObservable();

  private _transportSub: Subscription | null = null;
  private _transportStateSub: Subscription | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _currentSessionId: Nullable<string> = null;
  private _currentConnectionId: Nullable<string> = null;
  /** Joiner-side ephemeral keypair used to receive sessionKey rekey wraps. */
  private _userSecretKey: Nullable<Uint8Array> = null;
  /** Sequence counters for PtyData frames we send back upstream (driver input + heartbeats). */
  private _outboundSeq: Record<FrameChannel, number> = {
    [FrameChannel.Control]: 0,
    [FrameChannel.PtyData]: 0,
    [FrameChannel.SessionEvent]: 0,
  };

  constructor(
    @ILogService private readonly _logService: ILogService,
    @IConfigService private readonly _configService: IConfigService,
    @ISharedTerminalCryptoService private readonly _cryptoService: ISharedTerminalCryptoService,
    @ISharedTerminalTransportService private readonly _transportService: ISharedTerminalTransportService,
    @Optional(ITokenManager) private readonly _tokenManager?: ITokenManager,
    @Optional(ICollabInviteTransportServiceId) private readonly _inviteTransport?: ICollabInviteTransportService
  ) {
    super();
  }

  override dispose(): void {
    super.dispose();
    this._cleanupSubscriptions();
    this._stopHeartbeat();
    this._state$.complete();
    this._frames$.complete();
    this._snapshot$.complete();
    this._lastError$.complete();
    this._currentConnectionId$.complete();
    this._currentSessionId$.complete();
  }

  async connect(input: IParticipantConnectInput): Promise<IParticipantConnectResult> {
    const previous = this._state$.getValue();
    if (previous === ClientConnectionState.Connected || previous === ClientConnectionState.Connecting) {
      await this.disconnect();
    }

    this._state$.next(ClientConnectionState.Pairing);
    this._lastError$.next(null);

    let parsed: IParsedInvite;
    try {
      parsed = parseInviteUrl(input.inviteUrl);
    } catch (err) {
      this._fail(err, 'invite parse failed');
      throw err;
    }

    const config = this._configService.getConfig<ISharedTerminalPluginConfig>(SHARED_TERMINAL_PLUGIN_CONFIG_KEY);
    const relayBaseUrl = config?.relayBaseUrl?.replace(/\/+$/, '');
    if (!relayBaseUrl) {
      const err = new Error('shared-terminal: relayBaseUrl not configured (set ISharedTerminalPluginConfig.relayBaseUrl or deploy a relay).');
      this._fail(err, 'relay not configured');
      throw err;
    }

    // Relay routes by (userId, sessionId), where userId is derived from the JWT the
    // joiner sends through the WebSocket Bearer subprotocol. Without a token the
    // server rejects the upgrade with 401 — surface that as a "please sign in"
    // error before we even open the socket.
    const accountToken = await this._tokenManager?.getAccessToken();
    if (!accountToken) {
      const err = new Error('shared-terminal: sign in before joining a shared session — the relay requires the joiner\'s access token.');
      this._fail(err, 'access token unavailable');
      throw err;
    }

    // Derive the shared key from the invite's ephemeral private key + the daemon's
    // X25519 public key embedded in the capability. The relay enforces TTL +
    // capability hash matching server-side; we don't replicate that check here.
    const ephPriv = base64UrlToBytes(parsed.ephPriv);
    const daemonPub = base64UrlToBytes(parsed.capability.daemonPub);
    const sharedKey = this._cryptoService.deriveSharedKey(daemonPub, ephPriv);

    // Joiner-side long-term-ish keypair used to (a) receive the per-session symmetric
    // key wrapped by the daemon, (b) sign future driver requests. Lifetime = this
    // connection — discarded on disconnect().
    const userKp = this._cryptoService.generateKeypair();
    this._userSecretKey = userKp.secretKey;
    this._resetOutboundSeq();

    // Claim the invite server-side. The server marks the invite consumed
    // atomically and returns a `connectionId` + (cross-account) a one-shot
    // `relayClaimToken` we use as the relay WS RelayToken subprotocol. Claim
    // failure (already consumed / revoked / expired / wrong hash) surfaces as
    // a network error that the dialog displays.
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
        // We log a warning but proceed with same-account semantics so existing
        // tests + dev environments keep working.
        this._logService.warn('[ParticipantClientService] invite claim failed; falling back to same-account attach:', err);
      }
    }

    this._state$.next(ClientConnectionState.Connecting);

    try {
      await this._transportService.connect({
        relayBaseUrl,
        sessionId: parsed.capability.sid,
        accountToken,
        mode: 'client',
        connectionId: claimedConnectionId,
        relayClaimToken,
      }, sharedKey);
    } catch (err) {
      this._fail(err, 'transport connect failed');
      throw err;
    }

    this._currentSessionId = parsed.capability.sid;
    // Prefer the server-assigned connectionId (matches the relay routing key);
    // fall back to inviteId for legacy / pre-claim flows.
    const effectiveConnectionId = claimedConnectionId ?? parsed.inviteId;
    this._currentConnectionId = effectiveConnectionId;
    // Publish to the observable streams so the renderer can identify itself
    // without inferring from broadcast events (which is race-y).
    this._currentSessionId$.next(parsed.capability.sid);
    this._currentConnectionId$.next(effectiveConnectionId);

    this._startHeartbeat();

    this._transportStateSub = this._transportService.state$.subscribe((state) => {
      switch (state) {
        case TransportState.Connected:
          this._state$.next(ClientConnectionState.Connected);
          break;
        case TransportState.Connecting:
        case TransportState.Reconnecting:
          this._state$.next(ClientConnectionState.Connecting);
          break;
        case TransportState.Disconnected:
        case TransportState.Idle:
          this._state$.next(ClientConnectionState.Disconnected);
          break;
        case TransportState.Error:
          this._state$.next(ClientConnectionState.Error);
          break;
      }
    });

    this._transportSub = this._transportService.frames$.subscribe((inbound) => {
      const frame = inbound.frame;
      if (frame.channel === FrameChannel.SessionEvent) {
        this._consumeSessionEvent(frame);
      } else if (frame.channel === FrameChannel.Control) {
        this._consumeControlFrame(frame, daemonPub);
      }
      this._frames$.next(toClientFrame(frame));
    });

    // Announce ourselves to the daemon-side multiplexer. The daemon doesn't get any
    // "new client" notification from the relay — it relies on this control frame to
    // know who connected, with which role, and what their X25519 pubkey is (so it
    // can wrap the next sessionKey for us). The frame is encrypted with `sharedKey`
    // which the daemon can derive from the invite's ephPub + its own secret.
    this._sendClientJoin(parsed, userKp.publicKey);

    return {
      sessionId: parsed.capability.sid,
      connectionId: effectiveConnectionId,
      snapshot: this._snapshot$.getValue() ?? undefined,
    };
  }

  async disconnect(): Promise<void> {
    this._cleanupSubscriptions();
    this._stopHeartbeat();
    try {
      await this._transportService.disconnect();
    } catch (err) {
      this._logService.error('[ParticipantClientService] transport disconnect threw:', err);
    }
    this._currentSessionId = null;
    this._currentConnectionId = null;
    this._userSecretKey = null;
    this._currentSessionId$.next(null);
    this._currentConnectionId$.next(null);
    this._snapshot$.next(null);
    this._state$.next(ClientConnectionState.Disconnected);
  }

  async sendInput(data: Uint8Array): Promise<void> {
    if (this._state$.getValue() !== ClientConnectionState.Connected) {
      // Surfacing as a no-op (rather than throw) keeps the renderer key-handler
      // simple — typing while reconnecting just drops the input.
      return;
    }
    const seq = this._nextSeq(FrameChannel.PtyData);
    const frame: IFrame = {
      channel: FrameChannel.PtyData,
      flags: FrameFlag.None,
      seq,
      payload: data,
    };
    try {
      this._transportService.send(frame, { target: 'daemon' });
    } catch (err) {
      this._logService.warn('[ParticipantClientService] sendInput send failed:', err);
    }
  }

  async sendControl(message: object): Promise<void> {
    if (this._state$.getValue() !== ClientConnectionState.Connected) {
      return;
    }
    const seq = this._nextSeq(FrameChannel.Control);
    const frame: IFrame = {
      channel: FrameChannel.Control,
      flags: FrameFlag.None,
      seq,
      payload: new TextEncoder().encode(JSON.stringify(message)),
    };
    try {
      this._transportService.send(frame, { target: 'daemon' });
    } catch (err) {
      this._logService.warn('[ParticipantClientService] sendControl send failed:', err);
    }
  }

  private _consumeSessionEvent(frame: IFrame): void {
    try {
      const text = new TextDecoder().decode(frame.payload);
      const event = JSON.parse(text) as { type?: string };
      if (event.type === 'snapshot') {
        const snap = event as unknown as IParticipantSnapshot;
        this._snapshot$.next({
          sessionId: snap.sessionId,
          cols: snap.cols,
          rows: snap.rows,
          serialized: snap.serialized,
          observedSeq: snap.observedSeq,
        });
      }
    } catch (err) {
      this._logService.error('[ParticipantClientService] session event decode failed:', err);
    }
  }

  private _consumeControlFrame(frame: IFrame, daemonPub: Uint8Array): void {
    let message: { type?: string; wrappedKey?: string; senderPublicKey?: string; reason?: string };
    try {
      message = JSON.parse(new TextDecoder().decode(frame.payload));
    } catch (err) {
      this._logService.warn('[ParticipantClientService] control frame decode failed:', err);
      return;
    }
    if (message.type === 'rekey' && message.wrappedKey) {
      if (!this._userSecretKey) {
        this._logService.warn('[ParticipantClientService] rekey arrived without joiner secret key');
        return;
      }
      try {
        const senderPub = message.senderPublicKey
          ? base64UrlToBytes(message.senderPublicKey)
          : daemonPub;
        const wrapped = base64UrlToBytes(message.wrappedKey);
        const sessionKey = this._cryptoService.unwrapSessionKey(wrapped, senderPub, this._userSecretKey);
        this._transportService.rekey(sessionKey).catch((err) => {
          // Surface the failure to the UI rather than swallow it — without this,
          // daemon has already swapped to the new sessionKey and every subsequent
          // frame the joiner receives will fail secretbox.open silently.
          const reason = err instanceof Error ? err.message : String(err);
          this._logService.error('[ParticipantClientService] transport.rekey failed:', err);
          this._lastError$.next(`rekey failed: ${reason}`);
          this._state$.next(ClientConnectionState.Error);
        });
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this._logService.error('[ParticipantClientService] rekey unwrap failed:', err);
        this._lastError$.next(`rekey unwrap failed: ${reason}`);
        this._state$.next(ClientConnectionState.Error);
      }
      return;
    }
    if (message.type === 'error' && typeof message.reason === 'string') {
      // Daemon-side error feedback (e.g. session not registered, attachClient
      // failure). Surface in lastError$ so the UI can show the user.
      this._lastError$.next(`daemon error: ${message.reason}`);
      this._state$.next(ClientConnectionState.Error);
    }
  }

  private _sendClientJoin(parsed: IParsedInvite, userPublicKey: Uint8Array): void {
    const message = {
      type: 'client_join',
      inviteId: parsed.inviteId,
      role: parsed.capability.role,
      userPublicKey: bytesToBase64Url(userPublicKey),
    };
    const seq = this._nextSeq(FrameChannel.Control);
    const frame: IFrame = {
      channel: FrameChannel.Control,
      flags: FrameFlag.None,
      seq,
      payload: new TextEncoder().encode(JSON.stringify(message)),
    };
    try {
      this._transportService.send(frame, { target: 'daemon' });
    } catch (err) {
      this._logService.warn('[ParticipantClientService] client_join send failed:', err);
    }
  }

  private _nextSeq(channel: FrameChannel): number {
    const seq = this._outboundSeq[channel];
    this._outboundSeq[channel] = (seq + 1) >>> 0;
    return seq;
  }

  private _resetOutboundSeq(): void {
    this._outboundSeq[FrameChannel.Control] = 0;
    this._outboundSeq[FrameChannel.PtyData] = 0;
    this._outboundSeq[FrameChannel.SessionEvent] = 0;
  }

  /**
   * Periodic heartbeat upstream. The relay server does not notify the daemon
   * when this joiner's WebSocket closes; without these heartbeats, mux on the
   * owner side keeps a stale `client` entry forever and the forward-secrecy
   * detach-rekey never fires when the joiner actually leaves. The daemon
   * reaps any client that hasn't heartbeat'd within the threshold.
   */
  private _startHeartbeat(): void {
    this._stopHeartbeat();
    const HEARTBEAT_INTERVAL_MS = 5_000;
    this._heartbeatTimer = setInterval(() => {
      // sendControl guards on state internally and silently no-ops if we're
      // not Connected — safe to call on every tick.
      void this.sendControl({ type: 'heartbeat' });
    }, HEARTBEAT_INTERVAL_MS);
    if (typeof this._heartbeatTimer === 'object' && this._heartbeatTimer !== null && 'unref' in this._heartbeatTimer) {
      (this._heartbeatTimer as { unref: () => void }).unref();
    }
  }

  private _stopHeartbeat(): void {
    if (this._heartbeatTimer !== null) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  private _cleanupSubscriptions(): void {
    this._transportSub?.unsubscribe();
    this._transportSub = null;
    this._transportStateSub?.unsubscribe();
    this._transportStateSub = null;
  }

  private _fail(err: unknown, label: string): void {
    const message = err instanceof Error ? err.message : String(err);
    this._logService.error(`[ParticipantClientService] ${label}: ${message}`);
    this._lastError$.next(message);
    this._state$.next(ClientConnectionState.Error);
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
