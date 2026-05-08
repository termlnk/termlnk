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

export { AUTH_PLUGIN_CONFIG_KEY, AUTH_PLUGIN_NAME, HKDF_INFO, MASTER_KEY_DERIVATION } from './common/constants';
export type { IAuthPluginConfig } from './controllers/config.schema';
export type { IDerivationMaterial, IMasterKey } from './models/master-key';
export { MasterKeyState } from './models/master-key';
export { AuthState } from './models/session';
export type { AuthErrorCode, IAuthError, ITokenPair } from './models/session';
export type { ILoginInput, IRegisterInput, IUserAccount } from './models/user';
export { AuthPlugin } from './plugin';
export { IAuthClientService } from './services/auth-client.service';
export { IAuthService } from './services/auth.service';
export { IMasterKeyService } from './services/master-key.service';
export { ITokenStorageService } from './services/token-storage.service';
