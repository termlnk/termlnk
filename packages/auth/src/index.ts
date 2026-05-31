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

export { AUTH_DEVICE_ID_STORAGE_KEY, HKDF_INFO, KDF_VERSION, MASTER_KEY_DERIVATION } from './common/constants';
export { AUTH_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
export type { IAuthPluginConfig } from './controllers/config.schema';
export type { IDevice } from './models/device';
export type { IDerivationMaterial, IMasterKey } from './models/master-key';
export { MasterKeyState } from './models/master-key';
export { AuthError, AuthState, VaultState } from './models/session';
export type { AuthErrorCode, IAuthCapabilities, IAuthError, ITokenPair } from './models/session';
export type { ILoginInput, IRegisterInput, IUserAccount } from './models/user';
export { AUTH_PLUGIN_NAME, AuthPlugin } from './plugin';
export { IAuthService } from './services/auth.service';
export type { GoogleWebSignInStatus, IGoogleWebSignInBegin } from './services/auth.service';
export { IDeviceNameProvider } from './services/device-name-provider.service';
export { IGoogleSignInLauncher } from './services/google-sign-in-launcher';
export { IIdleProbe } from './services/idle-probe.service';
export { IAuthKeyValueStorage } from './services/key-value-storage.service';
export { IMasterKeyService } from './services/master-key.service';
export { IPasswordHasher } from './services/password-hasher.service';
export type { IArgon2idParams } from './services/password-hasher.service';
export { ISrpClientService } from './services/srp-client.service';
export type { ISrpClientSession, ISrpEnrollment, ISrpEphemeral } from './services/srp-client.service';
export { ITokenManager } from './services/token-manager.service';
export { ITokenRefresher } from './services/token-refresher.service';
export { ITokenStorageService } from './services/token-storage.service';
export { IUserStorageService } from './services/user-storage.service';
export { base64ToBytes, bytesToBase64, bytesToHex, hexToBytes, randomBytes } from './utils/encoding';
export { HttpRequestError, parseServerError } from './utils/http-server-error';
export type { IServerErrorBody, IServerErrorDetail } from './utils/http-server-error';
