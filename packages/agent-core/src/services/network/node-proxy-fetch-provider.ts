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

import type { IFetchProvider } from '@termlnk/network';
import type { IProxy } from '@termlnk/terminal';
import type { IProxyFetchHandle } from '../mcp/proxy-fetch';
import { Disposable, ILogService, Inject } from '@termlnk/core';
import { ConfigRepository } from '@termlnk/database';
import { NETWORK_PLUGIN_CONFIG_KEY } from '@termlnk/network';
import { debounceTime, filter, from, switchMap } from 'rxjs';
import { fetch as undiciFetch } from 'undici';
import { createProxyFetch, proxyConfigEqual } from '../mcp/proxy-fetch';

/**
 * NodeProxyFetchProvider — node-side IFetchProvider that routes traffic
 * through the user's configured HTTP / SOCKS5 proxy via undici dispatchers
 * and the socks library.
 *
 * Bootstrap chain (desktop main / web-server):
 *   core.registerPlugin(NetworkPlugin, {
 *     override: [[IFetchProvider, { useClass: NodeProxyFetchProvider }]],
 *   });
 * After this binding, every FetchHTTPImplementation consumer (HTTPService and
 * its callers) automatically routes through the proxy. agent-core's own
 * upstream calls (LLM provider sync, MCP registry, web fetch tool, etc.) all
 * acquire the same fetch via DI and stay aligned with the user's proxy
 * preference without each call site re-implementing proxy lookup.
 *
 * Confined to @termlnk/agent-core so undici / socks never leak into the
 * browser-isomorphic @termlnk/network package.
 *
 * Live reload: subscribes to ConfigRepository.changed$ for network.config /
 * proxy. When proxy settings flip on/off or change endpoint, the cached
 * handle is rebuilt and the previous undici dispatcher is closed so its
 * sockets don't leak; the cache is keyed on the proxy config snapshot for
 * stable identity.
 *
 * Race window: a fetch firing before the initial config load resolves goes
 * out direct (undici's default dispatcher). This is acceptable because the
 * proxy is opt-in — users without a configured proxy see no behaviour
 * change, and configured users hit the proxy by the next dispatch (config
 * loads in milliseconds).
 */
export class NodeProxyFetchProvider extends Disposable implements IFetchProvider {
  private _cachedProxy: IProxy | null = null;
  private _cachedHandle: IProxyFetchHandle | null = null;

  // No proxy active — undici fetch matches the standard signature closely
  // enough that the cast is safe in practice (undici tracks the WHATWG spec
  // and the differences live in stream init types we don't expose here).
  readonly fetch: typeof fetch = (input, init) => {
    const handle = this._cachedHandle;
    if (handle) {
      return handle.fetch(input as URL, init);
    }
    return undiciFetch(input as URL, init as never) as unknown as Promise<Response>;
  };

  constructor(
    @Inject(ConfigRepository) private readonly _configRepository: ConfigRepository,
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    void this._refreshFromConfig().catch((err) => {
      this._logService.warn('[NodeProxyFetchProvider] Initial proxy load failed:', err);
    });

    this.disposeWithMe(
      this._configRepository.changed$.pipe(
        filter((event) =>
          event.key === NETWORK_PLUGIN_CONFIG_KEY
          && (event.subKey === 'proxy' || event.subKey === undefined)
        ),
        debounceTime(200),
        switchMap(() => from(this._refreshFromConfig().catch((err) => {
          this._logService.warn('[NodeProxyFetchProvider] proxy reload failed:', err);
        })))
      ).subscribe()
    );
  }

  private async _refreshFromConfig(): Promise<void> {
    const proxy = await this._configRepository.getField<IProxy>(NETWORK_PLUGIN_CONFIG_KEY, 'proxy');
    if (!proxy?.enabled) {
      this._cachedProxy = null;
      this._closeCachedHandle();
      return;
    }
    if (this._cachedProxy && proxyConfigEqual(this._cachedProxy, proxy)) {
      return;
    }
    this._closeCachedHandle();
    this._cachedProxy = proxy;
    this._cachedHandle = createProxyFetch(proxy);
  }

  private _closeCachedHandle(): void {
    const handle = this._cachedHandle;
    this._cachedHandle = null;
    if (handle) {
      handle.close().catch((err) => {
        this._logService.warn('[NodeProxyFetchProvider] failed to close stale proxy dispatcher:', err);
      });
    }
  }

  override dispose(): void {
    super.dispose();
    this._cachedProxy = null;
    this._closeCachedHandle();
  }
}
