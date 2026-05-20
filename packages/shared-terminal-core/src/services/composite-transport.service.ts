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
import type { Observable, Subscription } from 'rxjs';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { TransportState } from '@termlnk/shared-terminal';
import { BehaviorSubject, Subject } from 'rxjs';
import { RelayTransportService } from './relay-transport.service';
import { WebRTCTransportService } from './webrtc-transport.service';

/** Active transport path, exposed for UI badge ("P2P" / "Relay"). */
export type TransportPath = 'webrtc' | 'relay' | null;

const WEBRTC_CONNECT_TIMEOUT_MS = 30_000;

/**
 * CompositeTransportService — WebRTC-first, Relay fallback.
 *
 * Lifecycle:
 *   1. connect() starts both transports.
 *   2. Relay is the immediate fallback path; it must reach Connected first.
 *   3. WebRTC races in parallel with a 30 s timeout.
 *   4. If WebRTC reaches Connected within the window, frames + sends flow through it
 *      and Relay enters standby (still keeps the socket but does not forward frames).
 *   5. If WebRTC errors or times out, Relay stays the active path.
 *   6. If WebRTC drops mid-session, Composite reverts to Relay without renegotiating.
 */
export class CompositeTransportService extends Disposable implements ISharedTerminalTransportService {
  private readonly _state$ = new BehaviorSubject<TransportState>(TransportState.Idle);
  readonly state$: Observable<TransportState> = this._state$.asObservable();

  private readonly _frames$ = new Subject<IInboundFrame>();
  readonly frames$: Observable<IInboundFrame> = this._frames$.asObservable();

  private readonly _activePath$ = new BehaviorSubject<TransportPath>(null);
  readonly activePath$: Observable<TransportPath> = this._activePath$.asObservable();

  private _relaySub: Nullable<Subscription> = null;
  private _webrtcSub: Nullable<Subscription> = null;

  constructor(
    @Inject(WebRTCTransportService) private readonly _webrtc: WebRTCTransportService,
    @Inject(RelayTransportService) private readonly _relay: RelayTransportService,
    @Inject(ILogService) private readonly _logService: ILogService
  ) {
    super();
  }

  override dispose(): void {
    super.dispose();
    this._teardownSubs();
    this._state$.complete();
    this._frames$.complete();
    this._activePath$.complete();
  }

  async connect(options: ITransportConnectOptions, sharedKey: ISharedKey): Promise<void> {
    this._state$.next(TransportState.Connecting);

    // 1. Relay is the immediate fallback — always wire it up first so we have somewhere
    //    to land traffic if WebRTC fails.
    try {
      await this._relay.connect(options, sharedKey);
      this._activePath$.next('relay');
      this._state$.next(TransportState.Connected);
    } catch (err) {
      this._state$.next(TransportState.Error);
      this._logService.error('[CompositeTransportService] relay connect failed:', err);
      throw err;
    }

    this._wireRelay();

    // 2. Race WebRTC negotiation against a 30 s timeout. Composite stays operational
    //    via Relay during this window; success swaps the active path silently.
    void this._tryWebrtc(options, sharedKey);
  }

  async disconnect(): Promise<void> {
    this._teardownSubs();
    try {
      await this._webrtc.disconnect();
    } catch (err) {
      this._logService.error('[CompositeTransportService] webrtc disconnect threw:', err);
    }
    try {
      await this._relay.disconnect();
    } catch (err) {
      this._logService.error('[CompositeTransportService] relay disconnect threw:', err);
    }
    this._activePath$.next(null);
    this._state$.next(TransportState.Disconnected);
  }

  send(frame: IFrame, options: ITransportSendOptions): void {
    const path = this._activePath$.getValue();
    if (path === 'webrtc') {
      this._webrtc.send(frame, options);
      return;
    }
    if (path === 'relay') {
      this._relay.send(frame, options);
      return;
    }
    throw new Error('[CompositeTransportService] not connected — no active transport');
  }

  async rekey(newSessionKey: Uint8Array): Promise<void> {
    // Apply to both transports so a path swap mid-session inherits the new key.
    await this._relay.rekey(newSessionKey).catch((err) => {
      this._logService.error('[CompositeTransportService] relay rekey failed:', err);
    });
    if (this._activePath$.getValue() === 'webrtc') {
      await this._webrtc.rekey(newSessionKey).catch((err) => {
        this._logService.error('[CompositeTransportService] webrtc rekey failed:', err);
      });
    }
  }

  async revokeConnection(connectionId: string): Promise<void> {
    await this._relay.revokeConnection(connectionId).catch((err) => {
      this._logService.error('[CompositeTransportService] relay revoke failed:', err);
    });
    if (this._activePath$.getValue() === 'webrtc') {
      await this._webrtc.revokeConnection(connectionId).catch((err) => {
        this._logService.error('[CompositeTransportService] webrtc revoke failed:', err);
      });
    }
  }

  private async _tryWebrtc(options: ITransportConnectOptions, sharedKey: ISharedKey): Promise<void> {
    if (!this._webrtc.isSupported()) {
      this._logService.log('[CompositeTransportService] WebRTC unsupported in this runtime; staying on relay');
      return;
    }

    try {
      await Promise.race([
        this._webrtc.connect(options, sharedKey),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('webrtc-timeout')), WEBRTC_CONNECT_TIMEOUT_MS)),
      ]);
      this._wireWebrtc();
      this._activePath$.next('webrtc');
      this._logService.log('[CompositeTransportService] swapped active path to WebRTC');
    } catch (err) {
      this._logService.log(`[CompositeTransportService] WebRTC unavailable, staying on relay (${err instanceof Error ? err.message : err})`);
    }
  }

  private _wireRelay(): void {
    this._relaySub?.unsubscribe();
    this._relaySub = this._relay.frames$.subscribe((frame) => {
      // Only forward when relay is the active path — otherwise we'd duplicate frames.
      if (this._activePath$.getValue() === 'relay') {
        this._frames$.next(frame);
      }
    });
  }

  private _wireWebrtc(): void {
    this._webrtcSub?.unsubscribe();
    this._webrtcSub = this._webrtc.frames$.subscribe((frame) => {
      if (this._activePath$.getValue() === 'webrtc') {
        this._frames$.next(frame);
      }
    });
  }

  private _teardownSubs(): void {
    this._relaySub?.unsubscribe();
    this._relaySub = null;
    this._webrtcSub?.unsubscribe();
    this._webrtcSub = null;
  }
}
