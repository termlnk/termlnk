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

import type { IRPCClientService } from '@termlnk/rpc-client';
import type { AppRouter } from '@termlnk/rpc-server';
import type { TRPCClient, TRPCWebSocketClient } from '@trpc/client';
import type { IWebRendererConfig } from '../../controllers/config.schema';
import { Disposable, IConfigService } from '@termlnk/core';
import { createTRPCClient, createWSClient, httpBatchLink, splitLink, wsLink } from '@trpc/client';
import { TRPC_HTTP_PATH, TRPC_WS_PATH, WEB_RENDERER_PLUGIN_CONFIG_KEY } from '../../controllers/config.schema';

/**
 * Browser-side IRPCClientService implementation: drop-in replacement for the
 * Electron-renderer version that uses `ipcLink`.
 *
 * Wire layout (cf. @termlnk/web-server):
 * - HTTP query / mutation -> `httpBatchLink` to `<origin>/trpc`
 * - WebSocket subscription -> `wsLink` to `<origin>/trpc-ws`
 * - `splitLink` routes by procedure type
 *
 * Cookies: `httpBatchLink` and the WebSocket upgrade both run under the
 * browser's same-origin policy. The session cookie set by `/__termlnk-web/login`
 * is `HttpOnly + SameSite=Strict`, so the browser auto-attaches it; we don't
 * touch credentials or headers here.
 *
 * URL shape: when `origin` config is empty (default same-origin deployment)
 * we feed httpBatchLink with the relative URL `/trpc`, which lets fetch
 * resolve against `window.location`. createWSClient demands an absolute URL,
 * so we convert `window.location` -> `ws[s]://...` ourselves.
 */
export class WebRPCClientService extends Disposable implements IRPCClientService {
  private _client: TRPCClient<AppRouter>;
  private _wsClient: TRPCWebSocketClient | null = null;

  constructor(
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();
    this._client = this._createClient();
  }

  override dispose(): void {
    super.dispose();
    this._wsClient?.close();
    this._wsClient = null;
  }

  getClient(): TRPCClient<AppRouter> {
    return this._client;
  }

  private _createClient(): TRPCClient<AppRouter> {
    const cfg = this._configService.getConfig<IWebRendererConfig>(WEB_RENDERER_PLUGIN_CONFIG_KEY);
    const httpUrl = `${cfg?.origin ?? ''}${TRPC_HTTP_PATH}`;
    const wsUrl = this._resolveWsUrl(cfg?.origin ?? '');

    this._wsClient = createWSClient({ url: wsUrl });

    return createTRPCClient<AppRouter>({
      links: [
        splitLink({
          condition: (op) => op.type === 'subscription',
          true: wsLink({ client: this._wsClient }),
          false: httpBatchLink({ url: httpUrl }),
        }),
      ],
    });
  }

  private _resolveWsUrl(origin: string): string {
    if (origin) {
      return `${origin.replace(/^http/, 'ws')}${TRPC_WS_PATH}`;
    }
    // Same-origin: derive from window.location. Falls back to ws://localhost
    // during SSR / non-browser unit tests so the link factory never throws.
    if (typeof window === 'undefined' || !window.location) {
      return `ws://localhost${TRPC_WS_PATH}`;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}${TRPC_WS_PATH}`;
  }
}
