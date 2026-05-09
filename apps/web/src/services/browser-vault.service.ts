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

import type { IAuthService } from '@termlnk/auth';
import type { ISyncCryptoService, ISyncTransportService } from '@termlnk/sync';
import type { HostType, IHostItemBase } from '@termlnk/terminal';
import type { Observable, Subscription } from 'rxjs';
import { AuthState, IAuthService as IAuthServiceId } from '@termlnk/auth';
import { createIdentifier, Disposable, ILogService, Inject } from '@termlnk/core';
import { ISyncCryptoService as ISyncCryptoServiceId, ISyncTransportService as ISyncTransportServiceId } from '@termlnk/sync';
import { BehaviorSubject } from 'rxjs';

/** clientId 持久化 key——重复打开同账号也复用同一 ID，避免后端 device 列表抖动。 */
const CLIENT_ID_STORAGE_KEY = 'termlnk-web.client-id';

const TEXT_DECODER = new TextDecoder();

/**
 * 浏览器端 vault 服务——用 ISyncTransportService.pull 拉 host 资源、用
 * ISyncCryptoService 解密 patch、把解出的 IHost 放到内存 BehaviorSubject。
 *
 * 设计依据：cloud-sync-architecture.md §3.3 / §7.2 / §7.3.5。
 *
 * 边界（与桌面端的 SyncService 区分）：
 * - 不做 push、outbox、Synchroniser 编排；纯 read 路径
 * - 不持久化解密后的 vault；登出 / 关闭 tab 即销毁
 * - 不依赖 @termlnk/database（所有持久化经 IndexedDB / localStorage 在 v2 再考虑；
 *   v1 走"每 tab 重启重拉"路径，与"登录密码每 tab 重输"对齐）
 */
export interface IBrowserVaultService {
  readonly hosts$: Observable<readonly IBrowserHost[]>;
  readonly status$: Observable<BrowserVaultStatus>;
  readonly lastError$: Observable<string | null>;

  /** 立即触发 host 资源 pull——通常 authState 转 Authenticated 时自动调用。 */
  refresh(): Promise<void>;
}

/** 浏览器视图下的 host 字段——只暴露列表 UI 需要的；credential / proxy 等细节按需在 v2 加。 */
export interface IBrowserHost extends Omit<IHostItemBase, 'type'> {
  readonly type: HostType;
  /** 仅当 type === HOST 时有值 */
  readonly addr?: string;
  readonly port?: number;
}

export const enum BrowserVaultStatus {
  Disabled = 'disabled', // 未配置 cloudBaseUrl 或未登录
  Idle = 'idle', // 已加载完毕等待下次 poke
  Pulling = 'pulling', // 网络中
  Error = 'error', // 上一次拉取失败
}

export const IBrowserVaultService = createIdentifier<IBrowserVaultService>('web.browser-vault-service');

interface IPullResponseShape {
  readonly cursor: string;
  readonly patch: readonly {
    readonly op: 'put' | 'del' | 'clear';
    readonly entityId: string | null;
    readonly payload: Uint8Array | null;
  }[];
}

export class BrowserVaultService extends Disposable implements IBrowserVaultService {
  private readonly _hosts$ = new BehaviorSubject<readonly IBrowserHost[]>([]);
  readonly hosts$: Observable<readonly IBrowserHost[]> = this._hosts$.asObservable();

  private readonly _status$ = new BehaviorSubject<BrowserVaultStatus>(BrowserVaultStatus.Disabled);
  readonly status$: Observable<BrowserVaultStatus> = this._status$.asObservable();

  private readonly _lastError$ = new BehaviorSubject<string | null>(null);
  readonly lastError$: Observable<string | null> = this._lastError$.asObservable();

  private readonly _hosts = new Map<string, IBrowserHost>();
  private _cursor: string | null = null;
  private readonly _clientId: string;

  private _authSub: Subscription | null = null;
  private _pokeSub: Subscription | null = null;
  private _connectedSub: Subscription | null = null;
  private _running = false;

  constructor(
    @Inject(IAuthServiceId) private readonly _auth: IAuthService,
    @Inject(ISyncTransportServiceId) private readonly _transport: ISyncTransportService,
    @Inject(ISyncCryptoServiceId) private readonly _crypto: ISyncCryptoService,
    @Inject(ILogService) private readonly _logService: ILogService
  ) {
    super();
    this._clientId = readOrCreateClientId();

    this._authSub = this._auth.authState$.subscribe((state) => {
      if (this._disposed) {
        return;
      }
      if (state === AuthState.Authenticated) {
        this._start();
      } else {
        this._stop();
      }
    });
  }

  override dispose(): void {
    if (this._disposed) {
      return;
    }
    this._stop();
    this._authSub?.unsubscribe();
    this._authSub = null;
    this._hosts$.complete();
    this._status$.complete();
    this._lastError$.complete();
    super.dispose();
  }

  async refresh(): Promise<void> {
    if (!this._running) {
      return;
    }
    await this._pullOnce();
  }

  // ---------- internal ----------

  private _start(): void {
    if (this._running || this._disposed) {
      return;
    }
    this._running = true;
    this._status$.next(BrowserVaultStatus.Pulling);
    this._lastError$.next(null);

    this._pokeSub = this._transport.poke$.subscribe((message) => {
      if (message.resource === 'host') {
        void this._pullOnce();
      }
    });

    this._connectedSub = this._transport.connected$.subscribe((connected) => {
      if (connected) {
        // 重连后立即追平
        void this._pullOnce();
      }
    });

    void this._transport.connect();
    void this._pullOnce();
  }

  private _stop(): void {
    this._running = false;
    this._pokeSub?.unsubscribe();
    this._pokeSub = null;
    this._connectedSub?.unsubscribe();
    this._connectedSub = null;
    void this._transport.disconnect();
    this._hosts.clear();
    this._cursor = null;
    this._hosts$.next([]);
    this._status$.next(BrowserVaultStatus.Disabled);
  }

  private async _pullOnce(): Promise<void> {
    if (!this._running || this._disposed) {
      return;
    }
    this._status$.next(BrowserVaultStatus.Pulling);

    try {
      const resp = (await this._transport.pull({
        clientId: this._clientId,
        resource: 'host',
        cursor: this._cursor,
      })) as IPullResponseShape;

      for (const item of resp.patch) {
        this._applyPatch(item);
      }
      this._cursor = resp.cursor;
      this._publish();

      this._status$.next(BrowserVaultStatus.Idle);
      this._lastError$.next(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._logService.warn('[BrowserVaultService] pull failed:', message);
      this._lastError$.next(message);
      this._status$.next(BrowserVaultStatus.Error);
    }
  }

  private _applyPatch(item: IPullResponseShape['patch'][number]): void {
    if (item.op === 'clear') {
      this._hosts.clear();
      return;
    }
    if (item.op === 'del') {
      if (item.entityId) {
        this._hosts.delete(item.entityId);
      }
      return;
    }
    if (item.op === 'put' && item.entityId && item.payload) {
      const decryptedBytes = this._crypto.decrypt(item.payload);
      const json = TEXT_DECODER.decode(decryptedBytes);
      const parsed = JSON.parse(json) as IHostJsonShape;
      const host: IBrowserHost = {
        id: parsed.id,
        pid: parsed.pid,
        label: parsed.label,
        type: parsed.type,
        sort: parsed.sort,
        addr: parsed.addr,
        port: parsed.port,
      };
      this._hosts.set(host.id, host);
    }
  }

  private _publish(): void {
    const out = [...this._hosts.values()].sort((a, b) => a.sort - b.sort);
    this._hosts$.next(out);
  }
}

interface IHostJsonShape {
  id: string;
  pid: string;
  label: string;
  type: HostType;
  sort: number;
  addr?: string;
  port?: number;
}

function readOrCreateClientId(): string {
  try {
    const cached = globalThis.localStorage?.getItem(CLIENT_ID_STORAGE_KEY);
    if (cached) {
      return cached;
    }
  } catch {
    // localStorage unavailable
  }
  // Web Crypto: 16 random bytes → hex
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  const id = `web-${hex}`;
  globalThis.localStorage?.setItem(CLIENT_ID_STORAGE_KEY, id);
  return id;
}
