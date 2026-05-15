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

import { AuthPlugin, IDeviceNameProvider, IIdleProbe, IPasswordHasher } from '@termlnk/auth';

import { AuthCorePlugin } from '@termlnk/auth-core';
import { Core, LocaleType, LogLevel } from '@termlnk/core';
import Constants from 'expo-constants';
import { ExpoAppStateIdleProbe } from '../platform/expo-app-state-idle-probe.service';
import { ExpoDeviceNameProvider } from '../platform/expo-device-name-provider.service';
import { LibsodiumPasswordHasher } from '../platform/libsodium-password-hasher.service';
import { MobilePlatformPlugin } from '../platform/mobile-platform.plugin';
// `react-native-get-random-values` polyfills the global `crypto.getRandomValues` —
// @noble/hashes, @noble/ciphers, and secure-remote-password all assume Web Crypto. The
// import side-effect must run before any auth-core code path that calls randomBytes.
import 'react-native-get-random-values';

interface IMobileCoreEnv {
  // Cloud root with version prefix. Resolved from app.json `extra.cloudBaseUrl` first,
  // then EXPO_PUBLIC_CLOUD_BASE_URL. Undefined leaves HttpAuthService unbound.
  cloudBaseUrl: string | undefined;
}

function readEnv(): IMobileCoreEnv {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const fromExtra = typeof extra.cloudBaseUrl === 'string' ? extra.cloudBaseUrl : undefined;
  const fromEnv = process.env.EXPO_PUBLIC_CLOUD_BASE_URL;
  return { cloudBaseUrl: fromExtra ?? fromEnv };
}

// Single-shot bootstrap; the returned Core owns the DI container + plugin lifecycle for
// the app's lifetime.
export function createMobileCore(): Core {
  const env = readEnv();

  const core = new Core({
    logLevel: LogLevel.INFO,
    locale: LocaleType.EN_US,
    locales: { enUS: {} },
  });

  core.registerPlugin(MobilePlatformPlugin);
  // 5-minute auto-lock so the master key drops out of memory after a backgrounded idle
  // window. ExpoAppStateIdleProbe drives the counter; IdleLockController polls and locks.
  core.registerPlugin(AuthPlugin, { autoLockIdleMinutes: 5 });
  // Overrides must go through AuthCorePlugin.override: redi `add` is append-not-replace,
  // and a second registerDependencies for the same identifier would accumulate and trip
  // "Expect 1 dependency item(s) … but get 2" when IdleLockController is touched.
  core.registerPlugin(AuthCorePlugin, {
    cloudBaseUrl: env.cloudBaseUrl,
    override: [
      [IIdleProbe, { useClass: ExpoAppStateIdleProbe }],
      [IDeviceNameProvider, { useClass: ExpoDeviceNameProvider }],
      // Hermes lacks WebAssembly; libsodium's `crypto_pwhash` provides a JSI Argon2id
      // that matches the cross-platform KAT.
      [IPasswordHasher, { useClass: LibsodiumPasswordHasher }],
    ],
  });

  core.start();
  return core;
}
