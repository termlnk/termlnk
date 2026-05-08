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

export type { IDerivedSubKeys } from './crypto/kdf';
export { computeArgon2Salt, deriveMasterKey, deriveSubKeys, zeroize } from './crypto/kdf';
export { MasterKeyService } from './services/master-key.service';
export { SrpClientService } from './services/srp-client.service';
