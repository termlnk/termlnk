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

export { AUTH_MOBILE_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
export type { IAuthMobileConfig } from './controllers/config.schema';
export { AUTH_MOBILE_PLUGIN_NAME, AuthMobilePlugin } from './plugin';
export { BiometricService, IBiometricService } from './services/biometric.service';
export type { BiometricCapability, IBiometricAvailability } from './services/biometric.service';
export { ExpoAppStateIdleProbe } from './services/expo-app-state-idle-probe.service';
export { ExpoDeviceNameProvider } from './services/expo-device-name-provider.service';
export { ExpoSecureStoreAuthKeyValueStorage } from './services/expo-secure-store-auth-key-value-storage.service';
export { LibsodiumPasswordHasher } from './services/libsodium-password-hasher.service';
