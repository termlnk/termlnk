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

import type { DependencyOverride } from '@termlnk/core';

/**
 * `web-server.config` 顶级 key——遵循"每插件一 key、持久化字段走 subKey"约束。
 *
 * 当前 Phase 7.1a 全部字段都是运行时启动参数；Phase 7.1c 引入 SRP6a
 * 时如需持久化字段（比如 SRP verifier、JWT secret 哈希）会以 subKey
 * 形式追加，不另开顶级 key。
 */
export const WEB_SERVER_PLUGIN_CONFIG_KEY = 'web-server.config';

/** tRPC HTTP 端点路径前缀。tRPC standalone adapter 默认就是 `/`，但为了与 SPA / 登录端点共存，显式分到子路径。 */
export const TRPC_HTTP_PATH_PREFIX = '/trpc';

/** tRPC WebSocket subscription 端点路径。由 P7.1b 实施。 */
export const TRPC_WS_PATH = '/trpc-ws';

/** SRP6a + 解锁握手端点的统一前缀。由 P7.1c 实施。 */
export const TERMLNK_WEB_AUTH_PATH_PREFIX = '/__termlnk-web';

export interface IWebServerConfig {
  /**
   * 监听端口。默认 3000。
   *
   * 推荐部署：用户在前端用 nginx / caddy 终止 TLS 后反代到 127.0.0.1:3000；
   * 此场景下 tlsCert / tlsKey 留空即可。
   *
   * 直连部署（家用 / 单机）：tlsCert + tlsKey 都配置时进程内置 https。
   */
  port?: number;

  /**
   * 监听地址。默认 `127.0.0.1`（仅本机）——配合反代是默认安全配置。
   * 直连场景设 `0.0.0.0`。
   */
  host?: string;

  /**
   * 静态 SPA 产物目录的绝对路径。该目录里应当至少存在 `index.html`。
   *
   * 不设置时，HTTP 服务只暴露 tRPC + 登录端点；非匹配请求返回 404。
   * 这种"无 SPA"模式给纯 API 部署或测试用。
   */
  staticRoot?: string;

  /**
   * TLS 证书 PEM 文件绝对路径。与 tlsKey 必须同时配置或同时缺失。
   * 都缺失时进程跑纯 HTTP（推荐反代场景）。
   */
  tlsCert?: string;

  /** TLS 私钥 PEM 文件绝对路径。与 tlsCert 同步配置。 */
  tlsKey?: string;

  /**
   * Plugin DI override；与 ElectronMainPlugin / SyncCorePlugin 同款机制——
   * 比如测试中替换 IWebServerService 为内存 fake，或注入自定义 IStaticFileService。
   */
  override?: DependencyOverride;
}

export const defaultPluginConfig: IWebServerConfig = {
  port: 3000,
  host: '127.0.0.1',
};
