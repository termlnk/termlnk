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
import { deviceName, modelName, osName } from 'expo-device';

// React Native binding for IDeviceNameProvider. Falls back through three sources so the
// device list on the server has something meaningful even when the user has not named
// their phone (the default on a fresh install):
//   1. `deviceName` — user-assigned name from iOS Settings / Android profile.
//   2. `modelName` + `osName` — e.g. "iPhone 15 Pro (iOS)".
//   3. Bare 'Mobile device' — guaranteed non-empty so the server never sees ''.
//
// Returns synchronously because IDeviceNameProvider contract is synchronous; the
// expo-device fields are populated at module load on both platforms (no async warmup).
export class ExpoDeviceNameProvider implements IDeviceNameProvider {
  getName(): string {
    if (deviceName && deviceName.length > 0) {
      return deviceName;
    }
    if (modelName && modelName.length > 0) {
      return osName ? `${modelName} (${osName})` : modelName;
    }
    return 'Mobile device';
  }
}
