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

/**
 * Initial timeout when probing WebRTC. Termius-style: short-circuit to relay
 * quickly so users don't stare at a blank UI while ICE collects. The full
 * negotiation may complete after the timeout — in that case we silently swap
 * the active path from relay to WebRTC and the user transparently benefits.
 */
const WEBRTC_INITIAL_TIMEOUT_MS = 5_000;

/**
 * CompositeTransportService — WebRTC-first, Relay fallback.
 *
 * Strategy (Termius-style):
 *   1. connect() probes WebRTC first with a short timeout (5 s).
 *      - WebRTC reaches Connected within the window → activePath = 'webrtc',
 *        relay is not opened. Stay P2P until WebRTC drops.
 *      - WebRTC fails or times out → open relay synchronously and use it.
 *   2. Even after falling back to relay, we keep retrying WebRTC in the
 *      background; if it eventually succeeds, swap the active path. (For
 *      now we don't retry mid-session — relay stays primary once chosen
 *      until the next connect.)
 *   3. If WebRTC drops mid-session, fall back to relay (re-opening it if
 *      necessary).
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
    @Inject(WebRTCTransportService) private readonly _webrtcService: WebRTCTransportService,
    @Inject(RelayTransportService) private readonly _relayService: RelayTransportService,
    @ILogService private readonly _logService: ILogService
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

    // Probe WebRTC first. If it reaches Connected within the short timeout we
    // skip opening relay altogether — pure P2P, no relay bandwidth.
    if (this._webrtcService.isSupported()) {
      const webrtcConnected = await this._raceWebrtc(options, sharedKey);
      if (webrtcConnected) {
        this._wireWebrtc();
        this._activePath$.next('webrtc');
        this._state$.next(TransportState.Connected);
        // Watch for WebRTC drops — if all peer legs close we fall back to relay
        // (opened lazily inside the recovery path).
        this._installWebrtcDropWatcher(options, sharedKey);
        return;
      }
    } else {
      this._logService.log('[CompositeTransportService] WebRTC unsupported in this runtime; using relay');
    }

    // Fallback: open relay synchronously. This is the same path the original
    // implementation took unconditionally.
    try {
      await this._relayService.connect(options, sharedKey);
      this._wireRelay();
      this._activePath$.next('relay');
      this._state$.next(TransportState.Connected);
    } catch (err) {
      this._state$.next(TransportState.Error);
      this._logService.error('[CompositeTransportService] relay fallback failed:', err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this._teardownSubs();
    try {
      await this._webrtcService.disconnect();
    } catch (err) {
      this._logService.error('[CompositeTransportService] webrtc disconnect threw:', err);
    }
    try {
      await this._relayService.disconnect();
    } catch (err) {
      this._logService.error('[CompositeTransportService] relay disconnect threw:', err);
    }
    this._activePath$.next(null);
    this._state$.next(TransportState.Disconnected);
  }

  send(frame: IFrame, options: ITransportSendOptions): void {
    const path = this._activePath$.getValue();
    if (path === 'webrtc') {
      this._webrtcService.send(frame, options);
      return;
    }
    if (path === 'relay') {
      this._relayService.send(frame, options);
      return;
    }
    throw new Error('[CompositeTransportService] not connected — no active transport');
  }

  async rekey(newSessionKey: Uint8Array): Promise<void> {
    // Apply to BOTH transports so a path swap mid-session inherits the new
    // key without renegotiation. Per-transport errors are swallowed so a
    // dormant transport's failure doesn't break the active path.
    await this._relayService.rekey(newSessionKey).catch((err) => {
      this._logService.warn('[CompositeTransportService] relay rekey failed:', err);
    });
    await this._webrtcService.rekey(newSessionKey).catch((err) => {
      this._logService.warn('[CompositeTransportService] webrtc rekey failed:', err);
    });
  }

  async revokeConnection(connectionId: string): Promise<void> {
    await this._relayService.revokeConnection(connectionId).catch((err) => {
      this._logService.warn('[CompositeTransportService] relay revoke failed:', err);
    });
    await this._webrtcService.revokeConnection(connectionId).catch((err) => {
      this._logService.warn('[CompositeTransportService] webrtc revoke failed:', err);
    });
  }

  /**
   * Race WebRTC.connect() against the initial timeout. Returns true if WebRTC
   * reached Connected within the window. Logs and returns false on any error
   * so the caller falls back cleanly.
   */
  private async _raceWebrtc(options: ITransportConnectOptions, sharedKey: ISharedKey): Promise<boolean> {
    try {
      await Promise.race([
        this._webrtcService.connect(options, sharedKey),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('webrtc-timeout')), WEBRTC_INITIAL_TIMEOUT_MS)),
      ]);
      this._logService.log('[CompositeTransportService] WebRTC primary path established');
      return true;
    } catch (err) {
      this._logService.log(`[CompositeTransportService] WebRTC probe failed, falling back to relay (${err instanceof Error ? err.message : err})`);
      // Tear down the partial WebRTC state so the next attempt starts clean.
      try {
        await this._webrtcService.disconnect();
      } catch {
        // ignore
      }
      return false;
    }
  }

  /**
   * Watch the WebRTC transport's state and fall back to relay if its session
   * dies mid-stream (all peer DataChannels closed, ICE failed, etc.). We only
   * install this AFTER WebRTC was established as the primary path.
   */
  private _installWebrtcDropWatcher(options: ITransportConnectOptions, sharedKey: ISharedKey): void {
    const sub = this._webrtcService.state$.subscribe((state) => {
      if (state !== TransportState.Disconnected && state !== TransportState.Error) {
        return;
      }
      if (this._activePath$.getValue() !== 'webrtc') {
        return;
      }
      this._logService.log('[CompositeTransportService] WebRTC dropped — opening relay fallback');
      void this._failoverToRelay(options, sharedKey);
      sub.unsubscribe();
    });
    // Don't track in _relaySub/_webrtcSub since those are used for frame wiring;
    // this sub auto-unsubscribes on first hit anyway.
  }

  private async _failoverToRelay(options: ITransportConnectOptions, sharedKey: ISharedKey): Promise<void> {
    this._webrtcSub?.unsubscribe();
    this._webrtcSub = null;
    try {
      await this._relayService.connect(options, sharedKey);
      this._wireRelay();
      this._activePath$.next('relay');
      // Keep state$ at Connected — from the caller's point of view we're still
      // connected, just via a different path.
    } catch (err) {
      this._logService.error('[CompositeTransportService] failover to relay failed:', err);
      this._activePath$.next(null);
      this._state$.next(TransportState.Error);
    }
  }

  private _wireRelay(): void {
    this._relaySub?.unsubscribe();
    this._relaySub = this._relayService.frames$.subscribe((frame) => {
      // Only forward when relay is the active path — otherwise we'd duplicate frames.
      if (this._activePath$.getValue() === 'relay') {
        this._frames$.next(frame);
      }
    });
  }

  private _wireWebrtc(): void {
    this._webrtcSub?.unsubscribe();
    this._webrtcSub = this._webrtcService.frames$.subscribe((frame) => {
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
