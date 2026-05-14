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

import type { IPokeMessage, IPullRequest, IPullResponse, IPushRequest, IPushResponse, ISyncMutation, ISyncPatchItem, ISyncTransportService, SyncResourceId } from '@termlnk/sync';
import type { Observable } from 'rxjs';
import { base64ToBytes, bytesToBase64, HttpRequestError } from '@termlnk/auth';
// Deep import: @termlnk/auth-core/index.ts re-exports AuthCorePlugin, which
// transitively pulls in better-sqlite3 via @termlnk/database. This service is
// shared across desktop/web/mobile, so we take the .ts subpath to keep
// SQLite out of browser bundles.
import { TokenManager } from '@termlnk/auth-core/services/token-manager.service.ts';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { SYNC_TRIGGER_INTERVALS } from '@termlnk/sync';
import { BehaviorSubject, Subject } from 'rxjs';

/** Reconnect backoff cap; we keep retrying past it but stop growing. */
const MAX_RECONNECT_BACKOFF_MS = 30_000;

/** Initial reconnect backoff (exponential base). */
const INITIAL_RECONNECT_BACKOFF_MS = 1_000;

/** WebSocket heartbeat interval; keeps NAT/proxy paths from silently dropping. */
const HEARTBEAT_INTERVAL_MS = SYNC_TRIGGER_INTERVALS.heartbeatMs;

/** Subset of `fetch` we depend on; lets tests inject a fake without binding to undici types. */
export type HttpFetchFn = (url: string, init: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) => Promise<{ ok: boolean; status: number; statusText: string; json: () => Promise<unknown>; text: () => Promise<string> }>;

/** Subset of `WebSocket` we depend on; lets tests inject a fake without binding to undici types. */
export interface IHttpWebSocket {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
  addEventListener: (type: 'open' | 'close' | 'error' | 'message', listener: (event: any) => void) => void;
}

export type HttpWebSocketCtor = new (url: string, protocols?: string[]) => IHttpWebSocket;

/**
 * Constructor config for HttpSyncTransportService.
 *
 * `baseUrl` is the cloud root (e.g. `https://cloud.termlnk.io/v1` or a
 * self-hosted address). Paths are appended directly:
 * `{baseUrl}/sync/push`, `{baseUrl}/sync/pull`,
 * `wss://...{baseUrl path}/sync/poke`.
 *
 * `fetchFn` / `webSocketCtor` are injection points; production uses the
 * defaults (`DEFAULT_FETCH_FN` / `DEFAULT_WEBSOCKET_CTOR`), tests inject fakes.
 */
export interface IHttpSyncTransportConfig {
  readonly baseUrl: string;
  /** WebSocket URL; derived from `baseUrl` when omitted (http→ws / https→wss + /sync/poke). */
  readonly websocketUrl?: string;
  /** `fetch` implementation; defaults to `globalThis.fetch`. */
  readonly fetchFn?: HttpFetchFn;
  /** `WebSocket` constructor; defaults to `globalThis.WebSocket`. */
  readonly webSocketCtor?: HttpWebSocketCtor;
}

/**
 * Default fetch: `globalThis.fetch`. Provided natively by Node 22+, browsers
 * and React Native — no polyfill needed.
 */
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

/**
 * Default WebSocket: `globalThis.WebSocket`. Provided natively by Node 22+,
 * browsers and React Native; conforms to RFC 6455. Passing the token via
 * subprotocol is a portable idiom across all three runtimes.
 */
const DEFAULT_WEBSOCKET_CTOR: HttpWebSocketCtor = globalThis.WebSocket as unknown as HttpWebSocketCtor;

/**
 * Wire format (matches cloud-sync-architecture.md §4.3):
 *
 * ```
 * POST {baseUrl}/sync/push
 *   Body: { clientId, mutations: [{ id, resource, op, entityId, payload, baseVersion, createdAt }] }
 *   Response: { accepted: number[], rejected: { id, reason }[], lastServerVersion: number }
 *
 * POST {baseUrl}/sync/pull
 *   Body: { clientId, resource, cursor }
 *   Response: { cursor, patch: PatchItem[], lastMutationId }
 *   PatchItem: { op: 'put'|'del'|'clear', resource, entityId, payload, version }
 *
 * WS  {baseUrl}/sync/poke
 *   Server → Client: { type: 'poke', resource, cursor }
 *   Client → Server: { type: 'ping' } every 30s
 * ```
 *
 * Uint8Array → JSON is base64. `payload` is `string | null` on the wire; on
 * deserialization a string is base64-decoded back to `Uint8Array`.
 */
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

/**
 * HTTP + WebSocket transport.
 *
 * Design notes:
 * - Auth: every request fetches an access token via `TokenManager.getAccessToken`
 *   and sets the `Bearer` header. If the token is expired and refresh fails the
 *   manager returns null; we throw "unauthenticated" so `SyncService`'s
 *   push/pull catch path can map it to `SyncErrorCode.unauthenticated`.
 * - Serialization: `Uint8Array ↔ base64` (JSON cannot carry binary). Field
 *   names are locked to architecture §4.3 — any rename requires a server-side
 *   change too.
 * - Reconnect: `connect()` opens the socket; on `onclose` we retry with
 *   exponential backoff (1s, 2s, 4s, …, 30s) until `disconnect()` is called.
 *   Heartbeat fires every 30s; if the peer closes, `onclose` runs.
 * - The WebSocket only emits `IPokeMessage`; the patch itself goes through
 *   HTTP `pull`.
 */
export class HttpSyncTransportService extends Disposable implements ISyncTransportService {
  private readonly _connected$ = new BehaviorSubject<boolean>(false);
  readonly connected$: Observable<boolean> = this._connected$.asObservable();

  private readonly _poke$ = new Subject<IPokeMessage>();
  readonly poke$: Observable<IPokeMessage> = this._poke$.asObservable();

  private _ws: IHttpWebSocket | null = null;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  /** Set true after `disconnect()`; suppresses further reconnect attempts. */
  private _stopped = false;
  /** Current exponential backoff (ms). */
  private _reconnectBackoff = INITIAL_RECONNECT_BACKOFF_MS;

  private readonly _fetchFn: HttpFetchFn;
  private readonly _webSocketCtor: HttpWebSocketCtor;

  constructor(
    private readonly _config: IHttpSyncTransportConfig,
    @Inject(TokenManager) private readonly _tokenManager: TokenManager,
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
      // SyncService maps this onto SyncErrorCode via .status / .serverCode — e.g.
      // 401+`unauthorized` → access token rejected; 401+`invalid_refresh` → caller must
      // re-auth. Without the typed payload the upper layer had no way to differentiate.
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
    // Pass the token via the RFC 6455 subprotocol field rather than a query
    // string, so server access logs do not record it.
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
      // Reconnect is handled in `onclose`, which fires right after `onerror`.
    });

    this._ws = ws;
  }

  private _handleSocketMessage(data: unknown): void {
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
    // Pong is ignored — its only purpose is to keep `onclose` from firing.
  }

  private _startHeartbeat(): void {
    this._clearHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      try {
        this._ws?.send(JSON.stringify({ type: 'ping' }));
      } catch (err) {
        this._logService.warn('[HttpSyncTransportService] heartbeat send failed:', err);
      }
    }, HEARTBEAT_INTERVAL_MS);
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
