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

/**
 * 跨平台 base64 / hex 编解码工具——纯函数，可在 Node 22+ / 浏览器 / React Native
 * （含 react-native-get-random-values polyfill）三类环境中无差异运行。
 *
 * 设计依据：cloud-sync-architecture.md §3.1 / §7.3——auth-core 与 sync-core 不应
 * 强绑 node:buffer / undici 等 Node 本局 API；wire format 一致才能让 vault 在任意端
 * 解出同一字节串。
 */

/** Convert raw bytes to standard base64 (with padding `=`). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  // btoa 是 Web 标准，Node 22+ / 浏览器 / RN（不需要 polyfill）皆原生提供。
  return btoa(binary);
}

/** Decode standard base64 to bytes; throws on invalid characters. */
export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/** Convert raw bytes to lowercase hex (no `0x` prefix). */
export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

/** Decode lowercase / uppercase hex to bytes; throws on odd length / invalid hex. */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('[hexToBytes] hex string length must be even');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new TypeError(`[hexToBytes] invalid hex at index ${i * 2}`);
    }
    out[i] = byte;
  }
  return out;
}

/**
 * Cryptographically-strong random bytes using Web Crypto API.
 *
 * 可用环境：
 * - Node 22+：`globalThis.crypto` 自带（基于 Web Crypto）
 * - 浏览器：原生
 * - React Native：需 `react-native-get-random-values` polyfill（在 app entry 之前 import）
 */
export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}
