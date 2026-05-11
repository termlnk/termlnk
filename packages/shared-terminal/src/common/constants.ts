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

// Bump on any frame layout / cipher change. The decode path dispatches by version and
// must keep older frames decodable.
export const SHARED_TERMINAL_FRAME_VERSION = 1;

// Wire-frame magic; distinct from sync's `tmsync1:` and the local SafeStorage `tmenc1:`.
// Full ciphertext: `tmst1:` + version(1) + nonce(24) + ciphertext+poly1305_tag.
export const SHARED_TERMINAL_FRAME_PREFIX = 'tmst1:';

// Cross-account invite capability version.
export const SHARED_TERMINAL_CAPABILITY_VERSION = 1;

// Per-frame payload cap. Larger PTY writes must be chunked. Sized to match typical MTU,
// WebSocket message budget, and the ring-buffer single-write block size.
export const SHARED_TERMINAL_FRAME_MAX_PAYLOAD = 64 * 1024; // 64 KiB

// Raw scrollback retained on top of xterm-headless so a late-attaching client can replay
// recent bytes verbatim. Serialized state would lose SGR boundaries.
export const SHARED_TERMINAL_RING_BUFFER_BYTES = 2 * 1024 * 1024; // 2 MiB

// Driver heartbeat liveness window. After this gap the daemon clears the driver mark so
// another writer can take over.
export const SHARED_TERMINAL_DRIVER_HEARTBEAT_TIMEOUT_MS = 5 * 1000;

// Client heartbeat cadence; keeps the WebSocket alive and refreshes the driver liveness mark.
export const SHARED_TERMINAL_HEARTBEAT_MS = 10 * 1000;

// Relay reconnect backoff: exponential from this base up to the max.
export const SHARED_TERMINAL_RECONNECT_INITIAL_MS = 1_000;
export const SHARED_TERMINAL_RECONNECT_MAX_MS = 30_000;

// Default invite TTL. Owner UI can change it to 1h / 24h / never.
export const SHARED_TERMINAL_INVITE_DEFAULT_TTL_MS = 15 * 60 * 1000;
