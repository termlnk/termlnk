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

export const SYNC_PLUGIN_NAME = 'SYNC_PLUGIN';
export const SYNC_PLUGIN_CONFIG_KEY = 'sync.config';

/**
 * 同步资源 ID — 与 SQLite 表对应（除 config 是字段级 LWW 外其他是行级 LWW）。
 *
 * 设计依据：cloud-sync-architecture.md §4.4。
 * 不同步：chat_session / chat_message / terminal_session_backup / mcp_oauth_token。
 */
export const SYNC_RESOURCES = ['host', 'config', 'ai_provider', 'mcp_server', 'skill'] as const;
export type SyncResourceId = (typeof SYNC_RESOURCES)[number];

/**
 * 触发节奏（毫秒）— 与 cloud-sync-architecture.md Δ9 一致。
 */
export const SYNC_TRIGGER_INTERVALS = {
  /** 本地变更后多久 flush outbox */
  pushDebounceMs: 500,
  /** 收到 poke 后多久 pull */
  pullDebounceMs: 200,
  /** 后台轮询间隔（兜底，主路径走 poke） */
  pollIntervalMs: 5 * 60 * 1000,
  /** WebSocket 心跳间隔 */
  heartbeatMs: 30 * 1000,
} as const;

/** 加密格式版本——升级算法时增加版本号便于解密路径 dispatch */
export const SYNC_PAYLOAD_VERSION = 1;

/** 加密 payload 标记前缀（区别于本地 SafeStorage 加密的 `tmenc1:`） */
export const SYNC_PAYLOAD_PREFIX = 'tmsync1:';
