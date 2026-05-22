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
import { Disposable, ILogService } from '@termlnk/core';
import { IFrameCodecService, SHARED_TERMINAL_HEARTBEAT_MS, SHARED_TERMINAL_RECONNECT_INITIAL_MS, SHARED_TERMINAL_RECONNECT_MAX_MS, TransportState } from '@termlnk/shared-terminal';
import { BehaviorSubject, Subject } from 'rxjs';

export interface IRelayWebSocket {
  readonly readyState?: number;
  send: (data: string | Uint8Array) => void;
  close: (code?: number, reason?: string) => void;
  addEventListener: (type: 'open' | 'close' | 'error' | 'message', listener: (event: any) => void) => void;
}

export type RelayWebSocketCtor = new (url: string, protocols?: string[]) => IRelayWebSocket;

export interface IRelayTransportServiceConfig {
  readonly webSocketCtor?: RelayWebSocketCtor;
}

interface IRelayEnvelope {
  readonly type?: string;
  readonly source?: string;
  readonly target?: string;
  readonly payload?: string;
  readonly connectionId?: string;
  readonly reason?: string;
}

const DEFAULT_WEBSOCKET_CTOR: RelayWebSocketCtor = globalThis.WebSocket as unknown as RelayWebSocketCtor;

export class RelayTransportService extends Disposable implements ISharedTerminalTransportService {
  private readonly _state$ = new BehaviorSubject<TransportState>(TransportState.Idle);
  readonly state$ = this._state$.asObservable();

  private readonly _frames$ = new Subject<IInboundFrame>();
  readonly frames$ = this._frames$.asObservable();

  private readonly _webSocketCtor: RelayWebSocketCtor;
  private _ws: Nullable<IRelayWebSocket> = null;
  private _options: Nullable<ITransportConnectOptions> = null;
  private _sharedKey: Nullable<ISharedKey> = null;
  private _stopped = true;
  private _reconnectBackoff = SHARED_TERMINAL_RECONNECT_INITIAL_MS;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _sessionKey: Nullable<ISharedKey> = null;
  private _connectionId: Nullable<string> = null;

  constructor(
    @IFrameCodecService private readonly _codecService: IFrameCodecService,
    @ILogService private readonly _logService: ILogService,
    config: IRelayTransportServiceConfig = {}
  ) {
    super();
    this._webSocketCtor = config.webSocketCtor ?? DEFAULT_WEBSOCKET_CTOR;
  }

  override dispose(): void {
    super.dispose();
    this._stopped = true;
    this._closeSocket();
    this._clearReconnectTimer();
    this._clearHeartbeat();
    this._state$.complete();
    this._frames$.complete();
  }

  async connect(options: ITransportConnectOptions, sharedKey: ISharedKey): Promise<void> {
    this._options = options;
    this._sharedKey = sharedKey;
    this._sessionKey = null;
    this._connectionId = options.connectionId ?? null;
    this._stopped = false;
    this._reconnectBackoff = SHARED_TERMINAL_RECONNECT_INITIAL_MS;
    await this._openSocket();
  }

  async disconnect(): Promise<void> {
    this._stopped = true;
    this._clearReconnectTimer();
    this._clearHeartbeat();
    this._closeSocket();
    this._state$.next(TransportState.Disconnected);
  }

  send(frame: IFrame, options: ITransportSendOptions): void {
    if (!this._ws || !this._currentKey()) {
      throw new Error('[RelayTransportService] cannot send before connected');
    }
    const wire = this._codecService.encrypt(frame, this._currentKey()!);
    this._ws.send(JSON.stringify({
      type: 'frame',
      target: options.target,
      payload: this._bytesToBase64(wire),
    }));
  }

  async rekey(newSessionKey: Uint8Array): Promise<void> {
    if (this._options?.mode !== 'daemon') {
      throw new Error('[RelayTransportService] rekey is only available in daemon mode');
    }
    this._sessionKey = { bytes: new Uint8Array(newSessionKey) };
  }

  async revokeConnection(connectionId: string): Promise<void> {
    if (this._options?.mode !== 'daemon') {
      throw new Error('[RelayTransportService] revokeConnection is only available in daemon mode');
    }
    this._ws?.send(JSON.stringify({ type: 'revoke', connectionId }));
  }

  private async _openSocket(): Promise<void> {
    if (!this._options || !this._sharedKey || this._ws) {
      return;
    }
    this._state$.next(
      this._state$.getValue() === TransportState.Disconnected
        ? TransportState.Reconnecting
        : TransportState.Connecting
    );

    const ws = new this._webSocketCtor(this._buildUrl(this._options), [`Bearer.${this._options.accountToken}`]);
    ws.addEventListener('open', () => {
      this._reconnectBackoff = SHARED_TERMINAL_RECONNECT_INITIAL_MS;
      this._state$.next(TransportState.Connected);
      this._startHeartbeat();
    });
    ws.addEventListener('message', (event) => this._handleSocketMessage(event.data));
    ws.addEventListener('close', () => {
      this._clearHeartbeat();
      this._ws = null;
      this._state$.next(TransportState.Disconnected);
      if (!this._stopped) {
        this._scheduleReconnect();
      }
    });
    ws.addEventListener('error', (event) => {
      this._logService.warn('[RelayTransportService] WebSocket error:', event);
      this._state$.next(TransportState.Error);
    });
    this._ws = ws;
  }

  private _handleSocketMessage(data: unknown): void {
    let envelope: IRelayEnvelope;
    try {
      const text = typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer);
      envelope = JSON.parse(text) as IRelayEnvelope;
    } catch (err) {
      this._logService.warn('[RelayTransportService] failed to parse relay envelope:', err);
      return;
    }

    if (envelope.type === 'ready' && envelope.connectionId) {
      this._connectionId = envelope.connectionId;
      return;
    }
    if (envelope.type === 'pong') {
      return;
    }
    if (envelope.type !== 'frame' || !envelope.payload) {
      return;
    }

    try {
      const frame = this._codecService.decrypt(this._base64ToBytes(envelope.payload), this._currentKey());
      this._frames$.next({
        source: envelope.source ?? (this._options?.mode === 'daemon' ? 'client' : 'daemon'),
        frame,
      });
    } catch (err) {
      this._logService.warn('[RelayTransportService] failed to decrypt relay frame:', err);
    }
  }

  private _buildUrl(options: ITransportConnectOptions): string {
    const url = new URL(`${options.relayBaseUrl.replace(/\/+$/, '')}/shared-terminal`);
    url.searchParams.set('v', '1');
    url.searchParams.set('mode', options.mode);
    url.searchParams.set('sessionId', options.sessionId);
    if (options.connectionId ?? this._connectionId) {
      url.searchParams.set('connectionId', options.connectionId ?? this._connectionId!);
    }
    return url.toString();
  }

  private _currentKey(): ISharedKey {
    if (this._sessionKey) {
      return this._sessionKey;
    }
    if (!this._sharedKey) {
      throw new Error('[RelayTransportService] sharedKey is unavailable');
    }
    return this._sharedKey;
  }

  private _startHeartbeat(): void {
    this._clearHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      try {
        this._ws?.send(JSON.stringify({ type: 'ping' }));
      } catch (err) {
        this._logService.warn('[RelayTransportService] heartbeat send failed:', err);
      }
    }, SHARED_TERMINAL_HEARTBEAT_MS);
  }

  private _scheduleReconnect(): void {
    if (this._reconnectTimer || this._stopped) {
      return;
    }
    const delay = this._reconnectBackoff;
    this._reconnectBackoff = Math.min(
      this._reconnectBackoff * 2,
      SHARED_TERMINAL_RECONNECT_MAX_MS
    );
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      void this._openSocket();
    }, delay);
  }

  private _clearReconnectTimer(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  private _clearHeartbeat(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  private _closeSocket(): void {
    if (!this._ws) {
      return;
    }
    try {
      this._ws.close(1000, 'client disconnect');
    } catch (err) {
      this._logService.warn('[RelayTransportService] WebSocket close failed:', err);
    }
    this._ws = null;
  }

  private _bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
  }

  private _base64ToBytes(value: string): Uint8Array {
    const binary = atob(value);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }
}
