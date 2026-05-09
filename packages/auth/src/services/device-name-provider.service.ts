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

import { createIdentifier } from '@termlnk/core';

// Supplies a human-readable device name for cloud registration without forcing auth-core
// to depend on `node:os`.
//
// Typical impls:
// - Electron main: wraps `os.hostname()`, falls back to 'Unknown device'.
// - Browser SPA:   parses navigator.userAgent or prompts the user, persisted in localStorage.
// - React Native:  expo-device + AsyncStorage.
//
// Used via Quantity.OPTIONAL injection — missing impl resolves to 'Unknown device'.
// Must be synchronous so register/login is not blocked.
export interface IDeviceNameProvider {
  getName(): string;
}

export const IDeviceNameProvider = createIdentifier<IDeviceNameProvider>(
  'auth.device-name-provider'
);
