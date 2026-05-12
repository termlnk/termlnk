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

// `react-native-get-random-values` polyfills the global `crypto.getRandomValues` —
// @noble/hashes, @noble/ciphers, and secure-remote-password all assume Web Crypto. The
// import side-effect must run before any auth-core code path that calls randomBytes.
import 'react-native-get-random-values';

import { AuthPlugin } from '@termlnk/auth';
import { AuthCorePlugin } from '@termlnk/auth-core';
import { Core, LocaleType, LogLevel } from '@termlnk/core';
import Constants from 'expo-constants';
import { MobilePlatformPlugin } from '../platform/mobile-platform.plugin';

interface IMobileCoreEnv {
  // Cloud root URL with `/v1` suffix (matches §6.1.4 auth + sync routes). Read from
  // app.json `extra.cloudBaseUrl` first, then EXPO_PUBLIC_CLOUD_BASE_URL. Undefined
  // disables the HttpAuthService binding and the UI prompts the user to configure it.
  cloudBaseUrl: string | undefined;
}

function readEnv(): IMobileCoreEnv {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const fromExtra = typeof extra.cloudBaseUrl === 'string' ? extra.cloudBaseUrl : undefined;
  const fromEnv = process.env.EXPO_PUBLIC_CLOUD_BASE_URL;
  return { cloudBaseUrl: fromExtra ?? fromEnv };
}

// Single-shot bootstrap. Caller invokes once on app launch (root layout's mount effect),
// gets a Core that owns the DI container + plugin lifecycle, and disposes on unmount.
// Hot reload during expo start does not re-create the Core; React's effect cleanup
// drops the previous instance first.
export function createMobileCore(): Core {
  const env = readEnv();

  const core = new Core({
    logLevel: LogLevel.INFO,
    locale: LocaleType.EN_US,
    locales: { enUS: {} },
  });

  core.registerPlugin(MobilePlatformPlugin);
  // 5-minute auto-lock matches §7.3.2: master key drops out of memory after the app has
  // been backgrounded for 5 minutes idle. ExpoAppStateIdleProbe drives the counter via
  // AppState.addEventListener; IdleLockController in @termlnk/auth-core polls and locks.
  core.registerPlugin(AuthPlugin, { autoLockIdleMinutes: 5 });
  core.registerPlugin(AuthCorePlugin, {
    cloudBaseUrl: env.cloudBaseUrl,
  });

  core.start();
  return core;
}
