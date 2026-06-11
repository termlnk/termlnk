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
import { authenticateAsync, hasHardwareAsync, isEnrolledAsync, supportedAuthenticationTypesAsync } from 'expo-local-authentication';

export type BiometricCapability =
  | 'unsupported' // no hardware
  | 'not-enrolled' // hardware exists but no biometric configured
  | 'available';

export interface IBiometricAvailability {
  readonly capability: BiometricCapability;
  // Best-effort label for the UI: 'Face ID' / 'Touch ID' / 'Biometrics'.
  readonly displayName: string;
}

// Wraps expo-local-authentication so the rest of the app does not have to know about
// LAContext / BiometricPrompt enum quirks. authenticate() returns true on success and
// false on user cancellation / failure — callers decide whether to surface an error
// or fall back to password entry. Throws only on programmer error (e.g. invoked while
// the underlying API itself is broken on this device).
export interface IBiometricService {
  getAvailability(): Promise<IBiometricAvailability>;
  authenticate(reason: string): Promise<boolean>;
}

export const IBiometricService = createIdentifier<IBiometricService>('mobile.biometric.service');

export class BiometricService implements IBiometricService {
  async getAvailability(): Promise<IBiometricAvailability> {
    const hasHardware = await hasHardwareAsync();
    if (!hasHardware) {
      return { capability: 'unsupported', displayName: 'Biometrics' };
    }
    const enrolled = await isEnrolledAsync();
    const types = await supportedAuthenticationTypesAsync();
    const displayName = this._displayNameFromTypes(types);
    if (!enrolled) {
      return { capability: 'not-enrolled', displayName };
    }
    return { capability: 'available', displayName };
  }

  // `reason` is shown in the iOS prompt subtitle and Android prompt description. Keep it
  // short and explain *why* the app needs auth — Apple HIG requires this. Empty string
  // falls back to expo-local-authentication's default copy.
  async authenticate(reason: string): Promise<boolean> {
    try {
      const result = await authenticateAsync({
        promptMessage: reason || 'Confirm your identity',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use passcode',
      });
      return result.success;
    } catch {
      return false;
    }
  }

  private _displayNameFromTypes(types: readonly number[]): string {
    // Match values from `LocalAuthenticationFeatureType` enum without importing it as a
    // value (Expo Modules export shape varies between SDK versions). Magic numbers are
    // stable across the underlying iOS / Android APIs.
    //   1 = FINGERPRINT, 2 = FACIAL_RECOGNITION, 3 = IRIS
    if (types.includes(2)) {
      return 'Face ID';
    }
    if (types.includes(1)) {
      return 'Touch ID';
    }
    if (types.includes(3)) {
      return 'Iris';
    }
    return 'Biometrics';
  }
}
