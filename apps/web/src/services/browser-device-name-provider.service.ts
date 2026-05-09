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

import type { IDeviceNameProvider } from '@termlnk/auth';

const STORAGE_KEY = 'termlnk-web.device-name';

/**
 * 浏览器端 IDeviceNameProvider 实现——`navigator.userAgent` 推断 + localStorage 持久化。
 *
 * 设备名仅供后端 device list / 撤销 UI 展示用，不参与认证；浏览器没有稳定的硬件
 * 标识符，所以这里用一份 localStorage 缓存的 "Browser on macOS" 形态字符串足够。
 * 用户后续可在 settings 中改名（v1 暂不实现 UI）。
 */
export class BrowserDeviceNameProvider implements IDeviceNameProvider {
  getName(): string {
    const cached = readLocalStorage(STORAGE_KEY);
    if (cached) {
      return cached;
    }
    const inferred = inferFromUserAgent();
    writeLocalStorage(STORAGE_KEY, inferred);
    return inferred;
  }
}

function inferFromUserAgent(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const browser = pickBrowser(ua);
  const os = pickOs(ua);
  if (browser && os) {
    return `${browser} on ${os}`;
  }
  if (browser) {
    return browser;
  }
  return 'Web browser';
}

function pickBrowser(ua: string): string | null {
  if (/Edg\//.test(ua)) {
    return 'Edge';
  }
  if (/OPR\//.test(ua) || /Opera/.test(ua)) {
    return 'Opera';
  }
  if (/Chrome\//.test(ua)) {
    return 'Chrome';
  }
  if (/Firefox\//.test(ua)) {
    return 'Firefox';
  }
  if (/Safari\//.test(ua)) {
    return 'Safari';
  }
  return null;
}

function pickOs(ua: string): string | null {
  if (/Mac OS X/.test(ua)) {
    return 'macOS';
  }
  if (/Windows/.test(ua)) {
    return 'Windows';
  }
  if (/Android/.test(ua)) {
    return 'Android';
  }
  if (/(iPhone|iPad|iOS)/.test(ua)) {
    return 'iOS';
  }
  if (/Linux/.test(ua)) {
    return 'Linux';
  }
  return null;
}

function readLocalStorage(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // 隐私浏览模式下 localStorage 可能不可写——忽略，下次再尝试推断
  }
}
