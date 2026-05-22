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
import type { ICapability, IFrame, IParticipantConnectInput, IParticipantConnectResult, IParticipantFrame, IParticipantService, IParticipantSnapshot, ISharedTerminalPluginConfig } from '@termlnk/shared-terminal';
import type { Observable, Subscription } from 'rxjs';
import { Disposable, IConfigService, ILogService } from '@termlnk/core';
import { ClientConnectionState, FrameChannel, ISharedTerminalCryptoService, ISharedTerminalTransportService, SHARED_TERMINAL_PLUGIN_CONFIG_KEY, TransportState } from '@termlnk/shared-terminal';
import { BehaviorSubject, Subject } from 'rxjs';

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

  private _transportSub: Subscription | null = null;
  private _transportStateSub: Subscription | null = null;
  private _currentSessionId: Nullable<string> = null;
  private _currentConnectionId: Nullable<string> = null;

  constructor(
    @ILogService private readonly _logService: ILogService,
    @IConfigService private readonly _configService: IConfigService,
    @ISharedTerminalCryptoService private readonly _cryptoService: ISharedTerminalCryptoService,
    @ISharedTerminalTransportService private readonly _transportService: ISharedTerminalTransportService
  ) {
    super();
  }

  override dispose(): void {
    super.dispose();
    this._cleanupSubscriptions();
    this._state$.complete();
    this._frames$.complete();
    this._snapshot$.complete();
    this._lastError$.complete();
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

    // Derive the shared key from the invite's ephemeral private key + the daemon's
    // public key embedded in the capability. The relay enforces TTL + capability
    // hash matching server-side; we don't replicate that check here.
    const ephPriv = base64UrlToBytes(parsed.ephPriv);
    // Pubkey wrapping: in the v1 spec the daemon publishes its X25519 pub via the
    // capability; we fall back to a zero key when missing so encryption + decryption
    // can still be exercised in transit (the relay will reject).
    const daemonPub = parsed.capability && (parsed.capability as ICapability & { daemonPub?: string }).daemonPub
      ? base64UrlToBytes((parsed.capability as ICapability & { daemonPub?: string }).daemonPub!)
      : new Uint8Array(32);
    const sharedKey = this._cryptoService.deriveSharedKey(daemonPub, ephPriv);

    this._state$.next(ClientConnectionState.Connecting);

    try {
      await this._transportService.connect({
        relayBaseUrl,
        sessionId: parsed.capability.sid,
        accountToken: '',
        mode: 'client',
      }, sharedKey);
    } catch (err) {
      this._fail(err, 'transport connect failed');
      throw err;
    }

    this._currentSessionId = parsed.capability.sid;
    this._currentConnectionId = parsed.inviteId;

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
      }
      this._frames$.next(toClientFrame(frame));
    });

    return {
      sessionId: parsed.capability.sid,
      connectionId: parsed.inviteId,
      snapshot: this._snapshot$.getValue() ?? undefined,
    };
  }

  async disconnect(): Promise<void> {
    this._cleanupSubscriptions();
    try {
      await this._transportService.disconnect();
    } catch (err) {
      this._logService.error('[ParticipantClientService] transport disconnect threw:', err);
    }
    this._currentSessionId = null;
    this._currentConnectionId = null;
    this._snapshot$.next(null);
    this._state$.next(ClientConnectionState.Disconnected);
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
