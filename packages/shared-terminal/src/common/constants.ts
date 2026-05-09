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

export const SHARED_TERMINAL_PLUGIN_NAME = 'SHARED_TERMINAL_PLUGIN';
export const SHARED_TERMINAL_PLUGIN_CONFIG_KEY = 'shared-terminal.config';

/**
 * Wire 帧格式版本——升级帧布局或加密原语时递增。
 * decode/encrypt 路径按版本 dispatch；老版本帧仍可解码（向后兼容铁律）。
 */
export const SHARED_TERMINAL_FRAME_VERSION = 1;

/**
 * Wire 帧前缀——区别于 sync 的 `tmsync1:` / 本地 SafeStorage 的 `tmenc1:`。
 * 完整密文格式：`tmst1:` + version(1) + nonce(24) + ciphertext+poly1305_tag。
 */
export const SHARED_TERMINAL_FRAME_PREFIX = 'tmst1:';

/**
 * QR 配对 payload 版本——QR 内含 daemon 长期公钥、relay endpoint、一次性 sessionId。
 * 升级 payload schema 时递增；旧客户端扫到新版 QR 时报"version unsupported"。
 */
export const SHARED_TERMINAL_QR_VERSION = 1;

/**
 * 协作邀请 capability 版本——cross-account 邀请的 capability token schema 版本。
 * 与 QR 解耦：QR 是同账号配对，capability 是跨账号协作。
 */
export const SHARED_TERMINAL_CAPABILITY_VERSION = 1;

/**
 * 单帧 payload 上限（字节）—— PTY 输出 fan-out 时如果一次写入超过此值需分帧。
 * 设计依据：MTU + WebSocket message 实践 + ring buffer 单写入块大小。
 */
export const SHARED_TERMINAL_FRAME_MAX_PAYLOAD = 64 * 1024; // 64 KiB

/**
 * Ring buffer 容量——xterm-headless 之外再保留一份 raw scrollback，便于客户端 attach
 * 时一次性补齐最近字节流而不是 serialize state（serialize 会丢 SGR 边界细节）。
 */
export const SHARED_TERMINAL_RING_BUFFER_BYTES = 2 * 1024 * 1024; // 2 MiB

/**
 * Driver 客户端心跳超时——超过此值未收到心跳则 daemon 自动清空 driver 标记，
 * 让其他 writer 可抢占。设计依据：cloud-sync-architecture.md §5.7.3。
 */
export const SHARED_TERMINAL_DRIVER_HEARTBEAT_TIMEOUT_MS = 5 * 1000;

/**
 * 客户端心跳间隔——保 WebSocket 活性 + 让 daemon 知道 driver 存活。
 */
export const SHARED_TERMINAL_HEARTBEAT_MS = 10 * 1000;

/**
 * Relay 重连退避起点（毫秒）——指数退避到 30s 上限。
 */
export const SHARED_TERMINAL_RECONNECT_INITIAL_MS = 1_000;
export const SHARED_TERMINAL_RECONNECT_MAX_MS = 30_000;

/**
 * 默认协作邀请有效期（毫秒）—— owner 可在 UI 改 1h / 24h / never。
 */
export const SHARED_TERMINAL_INVITE_DEFAULT_TTL_MS = 15 * 60 * 1000;
