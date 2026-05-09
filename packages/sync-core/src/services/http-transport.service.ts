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
import { base64ToBytes, bytesToBase64 } from '@termlnk/auth';
import { TokenManager } from '@termlnk/auth-core';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { SYNC_TRIGGER_INTERVALS } from '@termlnk/sync';
import { BehaviorSubject, Subject } from 'rxjs';

/** 最大重连退避时间——超过这个值就不再增长，但仍持续尝试。 */
const MAX_RECONNECT_BACKOFF_MS = 30_000;

/** 重连初始退避（指数 base） */
const INITIAL_RECONNECT_BACKOFF_MS = 1_000;

/** WebSocket 心跳：每 N ms 发一次 ping，避免 NAT/proxy 静默断连。 */
const HEARTBEAT_INTERVAL_MS = SYNC_TRIGGER_INTERVALS.heartbeatMs;

/**
 * 子集化的 fetch 函数签名——方便测试注入 fake，不强绑定 undici 类型。
 */
export type HttpFetchFn = (url: string, init: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) => Promise<{ ok: boolean; status: number; statusText: string; json: () => Promise<unknown>; text: () => Promise<string> }>;

/**
 * 子集化的 WebSocket 接口——方便测试注入 fake，不强绑定 undici 类型。
 */
export interface IHttpWebSocket {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
  addEventListener: (type: 'open' | 'close' | 'error' | 'message', listener: (event: any) => void) => void;
}

export type HttpWebSocketCtor = new (url: string, protocols?: string[]) => IHttpWebSocket;

/**
 * HttpSyncTransportService 配置——构造时注入。
 *
 * `baseUrl` 指向云服务根（如 `https://cloud.termlnk.io/v1` 或 self-host 地址），
 * 路径拼接：`{baseUrl}/sync/push`、`{baseUrl}/sync/pull`、`wss://...{baseUrl path}/sync/poke`。
 *
 * `fetchFn` / `webSocketCtor` 注入点：生产用 undici 默认值（DEFAULT_FETCH_FN /
 * DEFAULT_WEBSOCKET_CTOR），测试注 fake。
 */
export interface IHttpSyncTransportConfig {
  readonly baseUrl: string;
  /** WebSocket URL；不显式传时从 baseUrl 推导（http→ws / https→wss + /sync/poke）。 */
  readonly websocketUrl?: string;
  /** fetch 实现注入点；默认 globalThis.fetch。 */
  readonly fetchFn?: HttpFetchFn;
  /** WebSocket 构造器注入点；默认 globalThis.WebSocket。 */
  readonly webSocketCtor?: HttpWebSocketCtor;
}

/**
 * 默认 fetch—— globalThis.fetch；Node 22+ / 浏览器 / RN 原生提供，
 * 跨平台无需 polyfill 即可工作。
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
 * 默认 WebSocket—— globalThis.WebSocket；Node 22+ / 浏览器 / RN 均原生提供，
 * 接口与 RFC 6455 一致；子协议传 token 这一惯用法在三端通用。
 */
const DEFAULT_WEBSOCKET_CTOR: HttpWebSocketCtor = globalThis.WebSocket as unknown as HttpWebSocketCtor;

/**
 * Wire format（与 cloud-sync-architecture.md §4.3 一致）：
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
 *   Client → Server: { type: 'ping' } 每 30s 一次
 * ```
 *
 * Uint8Array → JSON：base64 字符串编码。`payload` 字段在 wire 上恒为 string|null，
 * 反序列化时若是 string 则 base64 解码回 Uint8Array。
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
 * HTTP / WebSocket transport 实现。
 *
 * 关键设计：
 * - 凭据：每个请求通过 TokenManager.getAccessToken 拿到 access token，附带 Bearer
 *   header。token 过期 / refresh 失败时返回 null —— 这里 throw "unauthenticated"
 *   让 SyncService 的 push/pull catch 路径转发为 SyncErrorCode.unauthenticated
 * - 序列化：Uint8Array ↔ base64（JSON 不能原生承载二进制）。Wire format 严格对齐
 *   架构 §4.3——任何字段名变更需要服务端同步
 * - 重连：connect() 主动发起连接；onclose 触发后立即指数退避（1s, 2s, 4s, ..., 30s）
 *   重试，直到 disconnect() 显式关闭。心跳 30s 一次，对端 close 即触发 onclose
 * - WebSocket 收消息后只发布 IPokeMessage——不解码 patch（patch 走 HTTP pull）
 */
export class HttpSyncTransportService extends Disposable implements ISyncTransportService {
  private readonly _connected$ = new BehaviorSubject<boolean>(false);
  readonly connected$: Observable<boolean> = this._connected$.asObservable();

  private readonly _poke$ = new Subject<IPokeMessage>();
  readonly poke$: Observable<IPokeMessage> = this._poke$.asObservable();

  private _ws: IHttpWebSocket | null = null;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  /** 是否已显式 disconnect——置 true 后不再触发重连 */
  private _stopped = false;
  /** 当前指数退避（ms） */
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
      throw new Error(`[HttpSyncTransportService] ${method} ${url} → ${resp.status} ${resp.statusText}${text ? `: ${text.slice(0, 200)}` : ''}`);
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
    // WebSocket 子协议字段携带凭据（RFC 6455）——避免在 URL query string 暴露 token，
    // 那种做法会被 server access log 落盘。
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
      // 不在这里发起重连——onclose 紧随其后会处理
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
    // pong 消息暂时忽略——心跳成功的副作用是 ws 不进 onclose
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
