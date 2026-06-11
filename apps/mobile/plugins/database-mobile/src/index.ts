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

export { DATABASE_MOBILE_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
export type { IDatabaseMobileConfig } from './controllers/config.schema';
export { DATABASE_MOBILE_PLUGIN_NAME, DatabaseMobilePlugin } from './plugin';
export { IDatabaseMobileAdaptorService } from './services/database-mobile-adaptor.service';
export type { DatabaseMobile } from './services/database-mobile-adaptor.service';
export { ExpoSqliteAdaptor } from './services/expo-sqlite-adaptor.service';
export { IMobileHostRepository, MobileHostRepository } from './services/mobile-host-repository';
export { IMobileIdentityRepository, IMobileKnownHostRepository, IMobileSshKeyRepository, MobileIdentityRepository, MobileKnownHostRepository, MobileSshKeyRepository } from './services/mobile-keychain-repositories';
export { IMobilePortForwardingRuleRepository, MobilePortForwardingRuleRepository } from './services/mobile-port-forwarding-rule-repository';
export { DEFAULT_PREFERENCES, IMobilePreferencesService, MobilePreferencesService } from './services/mobile-preferences.service';
export type { IMobilePreferences } from './services/mobile-preferences.service';
export { IMobileSecretCipherService, MobileSecretCipherService } from './services/mobile-secret-cipher.service';
export { IMobileSnippetRepository, MobileSnippetRepository } from './services/mobile-snippet-repository';
export { IRecentSessionsRepository, RecentSessionsRepository } from './services/recent-sessions-repository';
export type { IRecentSession, IRecentSessionKind } from './services/recent-sessions-repository';
export type { IMobileCredential, IMobileCredentialType, IMobileHost, IMobileHostFull, IMobileHostSettings, IMobileHostType, IMobileIdentity, IMobileIdentityFull, IMobileKnownHost, IMobilePortForwardingRule, IMobilePortForwardingRuleType, IMobileProxy, IMobileSnippet, IMobileSnippetRunMode, IMobileSshKey, IMobileSshKeyFull, ISshKeyAlgorithm, ISshKeySource } from './types';
