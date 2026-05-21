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

import type { ITokenManager } from '@termlnk/auth';
import type { IPokeMessage, IPullRequest, IPullResponse, IPushRequest, IPushResponse, ISyncMutation, ISyncPatchItem, ISyncTransportService, SyncResourceId } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import { base64ToBytes, bytesToBase64, HttpRequestError, ITokenManager as ITokenManagerId } from '@termlnk/auth';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { SYNC_TRIGGER_INTERVALS } from '@termlnk/sync';
import { BehaviorSubject, Subject } from 'rxjs';

const MAX_RECONNECT_BACKOFF_MS = 30_000;
const INITIAL_RECONNECT_BACKOFF_MS = 1_000;
const HEARTBEAT_INTERVAL_MS = SYNC_TRIGGER_INTERVALS.heartbeatMs;
const IDLE_TIMEOUT_MS = SYNC_TRIGGER_INTERVALS.idleTimeoutMs;
// Application-range close code (RFC 6455 §7.4.2, 4000-4999) so logs can tell a watchdog
// close from a peer disconnect; reconnect behaviour is identical.
const WS_CLOSE_CODE_IDLE = 4001;

// Narrow subsets of fetch / WebSocket so tests inject fakes without binding to undici types.
export type HttpFetchFn = (url: string, init: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) => Promise<{ ok: boolean; status: number; statusText: string; json: () => Promise<unknown>; text: () => Promise<string> }>;

export interface IHttpWebSocket {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
  addEventListener: (type: 'open' | 'close' | 'error' | 'message', listener: (event: any) => void) => void;
}

export type HttpWebSocketCtor = new (url: string, protocols?: string[]) => IHttpWebSocket;

export interface IHttpSyncTransportConfig {
  readonly baseUrl: string;
  // Derived from `baseUrl` when omitted (http→ws / https→wss + /sync/poke).
  readonly websocketUrl?: string;
  readonly fetchFn?: HttpFetchFn;
  readonly webSocketCtor?: HttpWebSocketCtor;
}

const DEFAULT_FETCH_FN: HttpFetchFn = async (url, init) => {
  const resp = await globalThis.fetch(url, init as RequestInit);
  return {
    ok: resp.ok,
    status: resp.status,
    statusText: resp.statusText,
    json: () => resp.json(),
    text: () => resp.text(),
  };
};

const DEFAULT_WEBSOCKET_CTOR: HttpWebSocketCtor = globalThis.WebSocket as unknown as HttpWebSocketCtor;

// Wire payloads. Field names are part of the server contract — renames require a
// coordinated server change. Uint8Array travels over the wire as base64.
interface IWirePushBody {
  clientId: string;
  mutations: IWireMutation[];
}

interface IWireMutation {
  id: number;
  resource: SyncResourceId;
  op: 'upsert' | 'delete';
  entityId: string;
  payload: string | null;
  baseVersion: number | null;
  createdAt: number;
}

interface IWirePullBody {
  clientId: string;
  resource: SyncResourceId;
  cursor: string | null;
}

interface IWirePullResponse {
  cursor: string;
  patch: IWirePatchItem[];
  lastMutationId: number;
}

interface IWirePatchItem {
  op: 'put' | 'del' | 'clear';
  resource: SyncResourceId;
  entityId: string | null;
  payload: string | null;
  version: number;
}

interface IWirePushResponse {
  accepted: number[];
  rejected: { id: number; reason: string }[];
  lastServerVersion: number;
}

interface IWirePokeMessage {
  type: 'poke';
  resource: SyncResourceId;
  cursor: string;
}

// HTTP + WebSocket transport. WebSocket only emits IPokeMessage; the patch itself goes
// through HTTP pull. Reconnect uses exponential backoff (1s..30s) until disconnect().
export class HttpSyncTransportService extends Disposable implements ISyncTransportService {
  private readonly _connected$ = new BehaviorSubject<boolean>(false);
  readonly connected$: Observable<boolean> = this._connected$.asObservable();

  private readonly _poke$ = new Subject<IPokeMessage>();
  readonly poke$: Observable<IPokeMessage> = this._poke$.asObservable();

  private _ws: IHttpWebSocket | null = null;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  // Refreshed by every inbound frame. The heartbeat tick force-closes when this falls
  // behind by more than IDLE_TIMEOUT_MS so a silently-dropped connection recovers.
  private _lastServerActivityAt = 0;
  // Set true after disconnect(); suppresses further reconnect attempts.
  private _stopped = false;
  private _reconnectBackoff = INITIAL_RECONNECT_BACKOFF_MS;

  private readonly _fetchFn: HttpFetchFn;
  private readonly _webSocketCtor: HttpWebSocketCtor;

  constructor(
    private readonly _config: IHttpSyncTransportConfig,
    @Inject(ITokenManagerId) private readonly _tokenManager: ITokenManager,
    @Inject(ILogService) private readonly _logService: ILogService
  ) {
    super();
    this._fetchFn = _config.fetchFn ?? DEFAULT_FETCH_FN;
    this._webSocketCtor = _config.webSocketCtor ?? DEFAULT_WEBSOCKET_CTOR;
  }

  override dispose(): void {
    this._stopped = true;
    this._closeSocket();
    this._clearReconnectTimer();
    this._clearHeartbeat();
    this._connected$.complete();
    this._poke$.complete();
    super.dispose();
  }

  async push(req: IPushRequest): Promise<IPushResponse> {
    const url = this._joinUrl('/sync/push');
    const body: IWirePushBody = {
      clientId: req.clientId,
      mutations: req.mutations.map((m) => this._serializeMutation(m)),
    };
    const resp = await this._fetchAuthorized(url, 'POST', body);
    const json = await resp.json() as IWirePushResponse;
    return {
      accepted: json.accepted,
      rejected: json.rejected,
      lastServerVersion: json.lastServerVersion,
    };
  }

  async pull(req: IPullRequest): Promise<IPullResponse> {
    const url = this._joinUrl('/sync/pull');
    const body: IWirePullBody = {
      clientId: req.clientId,
      resource: req.resource,
      cursor: req.cursor,
    };
    const resp = await this._fetchAuthorized(url, 'POST', body);
    const json = await resp.json() as IWirePullResponse;
    return {
      cursor: json.cursor,
      patch: json.patch.map((item) => this._deserializePatchItem(item)),
      lastMutationId: json.lastMutationId,
    };
  }

  async connect(): Promise<void> {
    this._stopped = false;
    this._reconnectBackoff = INITIAL_RECONNECT_BACKOFF_MS;
    await this._openSocket();
  }

  async disconnect(): Promise<void> {
    this._stopped = true;
    this._clearReconnectTimer();
    this._clearHeartbeat();
    this._closeSocket();
    this._connected$.next(false);
  }

  private _joinUrl(path: string): string {
    const base = this._config.baseUrl.replace(/\/+$/, '');
    return `${base}${path}`;
  }

  private _websocketUrl(): string {
    if (this._config.websocketUrl) {
      return this._config.websocketUrl;
    }
    const base = this._config.baseUrl.replace(/\/+$/, '');
    const wsBase = base.replace(/^http(s?):\/\//, (_match, s: string) => `ws${s}://`);
    return `${wsBase}/sync/poke`;
  }

  private async _fetchAuthorized(url: string, method: 'POST' | 'GET', body?: unknown): Promise<{ json: () => Promise<unknown> }> {
    const token = await this._tokenManager.getAccessToken();
    if (!token) {
      throw new Error('[HttpSyncTransportService] unauthenticated: no access token available');
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const resp = await this._fetchFn(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new HttpRequestError(`${method} ${url}`, resp.status, resp.statusText, text);
    }

    return { json: () => resp.json() };
  }

  private _serializeMutation(m: ISyncMutation): IWireMutation {
    return {
      id: m.id,
      resource: m.resource,
      op: m.op,
      entityId: m.entityId,
      payload: m.payload === null ? null : bytesToBase64(m.payload),
      baseVersion: m.baseVersion,
      createdAt: m.createdAt,
    };
  }

  private _deserializePatchItem(wire: IWirePatchItem): ISyncPatchItem {
    return {
      op: wire.op,
      resource: wire.resource,
      entityId: wire.entityId,
      payload: wire.payload === null ? null : base64ToBytes(wire.payload),
      version: wire.version,
    };
  }

  private async _openSocket(): Promise<void> {
    if (this._ws) {
      return;
    }
    const token = await this._tokenManager.getAccessToken();
    if (!token) {
      this._logService.warn('[HttpSyncTransportService] cannot open WS: no access token');
      this._scheduleReconnect();
      return;
    }

    const url = this._websocketUrl();
    // Pass token via RFC 6455 subprotocol so access logs do not record it.
    const ws = new this._webSocketCtor(url, [`Bearer.${token}`]);

    ws.addEventListener('open', () => {
      this._reconnectBackoff = INITIAL_RECONNECT_BACKOFF_MS;
      this._connected$.next(true);
      this._startHeartbeat();
      this._logService.log('[HttpSyncTransportService] WebSocket connected');
    });

    ws.addEventListener('message', (event) => {
      this._handleSocketMessage(event.data);
    });

    ws.addEventListener('close', () => {
      this._connected$.next(false);
      this._clearHeartbeat();
      this._ws = null;
      if (!this._stopped) {
        this._scheduleReconnect();
      }
    });

    ws.addEventListener('error', (event) => {
      this._logService.warn('[HttpSyncTransportService] WebSocket error:', event);
      // Reconnect runs from `onclose`, which fires right after `onerror`.
    });

    this._ws = ws;
  }

  private _handleSocketMessage(data: unknown): void {
    // Any inbound frame proves the server side is alive; pong has no payload to surface
    // but updating the liveness clock is its whole job.
    this._lastServerActivityAt = Date.now();

    let parsed: IWirePokeMessage | { type: 'pong' };
    try {
      const text = typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer);
      parsed = JSON.parse(text);
    } catch (err) {
      this._logService.warn('[HttpSyncTransportService] failed to parse WS message:', err);
      return;
    }

    if (parsed.type === 'poke') {
      const poke = parsed as IWirePokeMessage;
      this._poke$.next({ type: 'poke', resource: poke.resource, cursor: poke.cursor });
    }
  }

  // Single timer drives both halves of liveness: each tick first checks for an idle
  // gap longer than IDLE_TIMEOUT_MS (force-close to recover), then sends a keepalive
  // ping. HEARTBEAT_INTERVAL_MS stays well under the 60s idle window common to
  // Nginx / ALB / Cloudflare so three ticks fit inside any proxy's window.
  private _startHeartbeat(): void {
    this._clearHeartbeat();
    this._lastServerActivityAt = Date.now();
    this._heartbeatTimer = setInterval(() => this._heartbeatTick(), HEARTBEAT_INTERVAL_MS);
  }

  private _heartbeatTick(): void {
    const idleFor = Date.now() - this._lastServerActivityAt;
    if (idleFor > IDLE_TIMEOUT_MS) {
      this._logService.warn(`[HttpSyncTransportService] no server activity for ${idleFor}ms; closing to reconnect`);
      try {
        this._ws?.close(WS_CLOSE_CODE_IDLE, 'idle timeout');
      } catch (err) {
        this._logService.warn('[HttpSyncTransportService] watchdog close failed:', err);
      }
      return;
    }
    try {
      this._ws?.send(JSON.stringify({ type: 'ping' }));
    } catch (err) {
      this._logService.warn('[HttpSyncTransportService] heartbeat send failed:', err);
    }
  }

  private _clearHeartbeat(): void {
    if (this._heartbeatTimer !== null) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  private _scheduleReconnect(): void {
    if (this._reconnectTimer !== null || this._stopped) {
      return;
    }
    const delay = this._reconnectBackoff;
    this._reconnectBackoff = Math.min(this._reconnectBackoff * 2, MAX_RECONNECT_BACKOFF_MS);
    this._logService.log(`[HttpSyncTransportService] scheduling WebSocket reconnect in ${delay}ms`);
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      void this._openSocket();
    }, delay);
  }

  private _clearReconnectTimer(): void {
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  private _closeSocket(): void {
    if (this._ws) {
      try {
        this._ws.close(1000, 'client disconnect');
      } catch (err) {
        this._logService.warn('[HttpSyncTransportService] WS close failed:', err);
      }
      this._ws = null;
    }
  }
}
