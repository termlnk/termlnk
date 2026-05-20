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
import type { IFrame, IFrameCodecService, IInboundFrame, ISharedKey, ISharedTerminalTransportService, ITransportConnectOptions, ITransportSendOptions } from '@termlnk/shared-terminal';
import type { Observable } from 'rxjs';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { IFrameCodecService as IFrameCodecServiceId, TransportState } from '@termlnk/shared-terminal';
import { BehaviorSubject, Subject } from 'rxjs';

declare const RTCPeerConnection: { new (config?: any): any } | undefined;

/**
 * WebRTC transport.
 *
 * The contract surface matches RelayTransportService so CompositeTransportService can
 * fan-in / fan-out frames uniformly. The actual ICE / DataChannel handshake is gated on
 * the host environment exposing `RTCPeerConnection`:
 *
 *   - Renderer (Electron) : RTCPeerConnection is available natively.
 *   - Main process        : requires `@roamhq/wrtc` (or equivalent) to be installed.
 *
 * The signaling layer (POST to `cloud.termlnk.com/v1/multiplayer/signal`) is not yet
 * wired up — when that endpoint is deployed we drop in the SDP / ICE exchange behind
 * `_negotiate`. Until then connect() reports an error on state$ + frames$ so
 * CompositeTransportService can fall back to RelayTransportService transparently.
 *
 * Why ship the stub now: the binding, DI graph, and composite routing are the
 * load-bearing parts of M5. Replacing _negotiate() with a real ICE exchange is a
 * surgical change that does not touch any caller.
 */
export class WebRTCTransportService extends Disposable implements ISharedTerminalTransportService {
  private readonly _state$ = new BehaviorSubject<TransportState>(TransportState.Idle);
  readonly state$: Observable<TransportState> = this._state$.asObservable();

  private readonly _frames$ = new Subject<IInboundFrame>();
  readonly frames$: Observable<IInboundFrame> = this._frames$.asObservable();

  private _pc: any = null;
  private _sharedKey: Nullable<ISharedKey> = null;
  private _options: Nullable<ITransportConnectOptions> = null;

  constructor(
    @Inject(IFrameCodecServiceId) private readonly _codec: IFrameCodecService,
    @Inject(ILogService) private readonly _logService: ILogService
  ) {
    super();
  }

  override dispose(): void {
    super.dispose();
    this._closePeer();
    this._state$.complete();
    this._frames$.complete();
  }

  isSupported(): boolean {
    return typeof RTCPeerConnection !== 'undefined';
  }

  async connect(options: ITransportConnectOptions, sharedKey: ISharedKey): Promise<void> {
    this._options = options;
    this._sharedKey = sharedKey;
    if (!this.isSupported()) {
      this._state$.next(TransportState.Error);
      throw new Error('[WebRTCTransportService] RTCPeerConnection is not available in this runtime');
    }
    this._state$.next(TransportState.Connecting);
    try {
      await this._negotiate(options);
    } catch (err) {
      this._state$.next(TransportState.Error);
      this._logService.error('[WebRTCTransportService] negotiate failed:', err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this._closePeer();
    this._state$.next(TransportState.Disconnected);
  }

  send(_frame: IFrame, _options: ITransportSendOptions): void {
    if (this._state$.getValue() !== TransportState.Connected) {
      throw new Error('[WebRTCTransportService] not connected — cannot send');
    }
    // Wire encoding + DataChannel.send go here once _negotiate is implemented.
    throw new Error('[WebRTCTransportService] send() not implemented in the M5 stub');
  }

  async rekey(_newSessionKey: Uint8Array): Promise<void> {
    if (this._options?.mode !== 'daemon') {
      throw new Error('[WebRTCTransportService] rekey is only available in daemon mode');
    }
    throw new Error('[WebRTCTransportService] rekey() not implemented in the M5 stub');
  }

  async revokeConnection(_connectionId: string): Promise<void> {
    if (this._options?.mode !== 'daemon') {
      throw new Error('[WebRTCTransportService] revokeConnection is only available in daemon mode');
    }
    throw new Error('[WebRTCTransportService] revokeConnection() not implemented in the M5 stub');
  }

  /**
   * Placeholder for the ICE / SDP exchange. Once the cloud signalling endpoint is
   * deployed (POST /v1/multiplayer/signal), this method:
   *
   *   1. Creates RTCPeerConnection with ICE servers from config.
   *   2. Opens a `tmst1` DataChannel.
   *   3. Generates offer, sends to cloud, waits for answer.
   *   4. Exchanges ICE candidates over the same channel.
   *   5. On DataChannel.open → state$ = Connected.
   *
   * Until then we throw so CompositeTransportService's failover catches it instantly.
   */
  private async _negotiate(_options: ITransportConnectOptions): Promise<void> {
    // Intentionally throw — see class JSDoc. Composite picks up the failure and
    // falls back to RelayTransportService without surfacing the WebRTC unavailability
    // to the renderer. _codec / _sharedKey will be consumed once the real ICE / SDP
    // exchange lands; until then they sit unused.
    throw new Error('[WebRTCTransportService] signalling endpoint not configured (cloud /v1/multiplayer/signal pending)');
  }

  private _closePeer(): void {
    if (this._pc) {
      this._pc.close();
      this._pc = null;
    }
  }
}
