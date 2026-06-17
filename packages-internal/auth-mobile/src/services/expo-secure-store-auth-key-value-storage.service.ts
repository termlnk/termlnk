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

import type { IAuthKeyValueStorage } from '@termlnk/auth';
import { deleteItemAsync, getItemAsync, setItemAsync, WHEN_UNLOCKED_THIS_DEVICE_ONLY } from 'expo-secure-store';

const KEY_PREFIX = 'termlnk.auth.';

// iOS Keychain / Android Keystore-backed IAuthKeyValueStorage. expo-secure-store wraps
// both with consistent semantics: values are encrypted by the OS, scoped to this app
// + this device (no iCloud / backup propagation), and unavailable when the device is
// locked the first time after boot.
//
// `WHEN_UNLOCKED_THIS_DEVICE_ONLY` matches Termius' Apple Secure Enclave docs: the item
// is readable only after first unlock-after-boot, never written to iCloud backups, and
// gone on device wipe. This is the strictest setting expo-secure-store offers without
// requiring biometric per-access.
//
// Keys are prefixed so a future feature can persist non-auth secrets here without
// colliding with TokenStorageService's `tokens` key. iOS Keychain quietly truncates
// keys past 255 chars; we stay well under that.
export class ExpoSecureStoreAuthKeyValueStorage implements IAuthKeyValueStorage {
  async getString(key: string): Promise<string | null> {
    return getItemAsync(KEY_PREFIX + key, {
      keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  async setString(key: string, value: string): Promise<void> {
    await setItemAsync(KEY_PREFIX + key, value, {
      keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  async deleteKey(key: string): Promise<void> {
    await deleteItemAsync(KEY_PREFIX + key, {
      keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
}
