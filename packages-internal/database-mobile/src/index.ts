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
export { aiChatMessageEntity } from './entities/ai-chat-message';
export type { IAiChatMessageEntity, IAiChatMessageEntityInsert } from './entities/ai-chat-message';
export { aiChatSessionEntity } from './entities/ai-chat-session';
export type { IAiChatSessionEntity, IAiChatSessionEntityInsert } from './entities/ai-chat-session';
export { aiCustomModelEntity } from './entities/ai-custom-model';
export type { IAiCustomModelEntity, IAiCustomModelEntityInsert } from './entities/ai-custom-model';
export { aiProviderEntity } from './entities/ai-provider';
export type { IAiProviderEntity, IAiProviderEntityInsert } from './entities/ai-provider';
export { aiProviderModelEntity } from './entities/ai-provider-model';
export type { IAiProviderModelEntity, IAiProviderModelEntityInsert } from './entities/ai-provider-model';
export { generateId } from './entities/base';
export { mcpServerEntity } from './entities/mcp-server';
export type { IMcpServerEntity, IMcpServerEntityInsert } from './entities/mcp-server';
export type { IPortForwardingRuleEntity, IPortForwardingRuleEntityInsert, PortForwardingType } from './entities/port-forwarding-rule';
export { skillEntity } from './entities/skill';
export type { ISkillEntity, ISkillEntityInsert } from './entities/skill';
export type { IMobileSnippetType, ISnippetEntity, ISnippetEntityInsert } from './entities/snippet';
export { DEFAULT_SNIPPET_ROOT } from './entities/snippet';
export { DATABASE_MOBILE_PLUGIN_NAME, DatabaseMobilePlugin } from './plugin';
export { ExpoSqliteAdaptor, IDatabaseMobileAdaptorService } from './services/expo-sqlite-adaptor.service';
export type { DatabaseMobile } from './services/expo-sqlite-adaptor.service';
export { IMobileHostRepository, MobileHostRepository } from './services/mobile-host-repository';
export { IMobileIdentityRepository, IMobileKnownHostRepository, IMobileSshKeyRepository, MobileIdentityRepository, MobileKnownHostRepository, MobileSshKeyRepository } from './services/mobile-keychain-repositories';
export { MobileMcpServerRepository } from './services/mobile-mcp-server-repository';
export { IMobilePortForwardingRuleRepository, MobilePortForwardingRuleRepository } from './services/mobile-port-forwarding-rule-repository';
export { DEFAULT_MOBILE_DARK_THEME_NAME, DEFAULT_MOBILE_LIGHT_THEME_NAME, DEFAULT_PREFERENCES, IMobilePreferencesService, MobilePreferencesService } from './services/mobile-preferences.service';
export type { IMobilePreferences, TerminalCursorStyle, ThemeMode } from './services/mobile-preferences.service';
export { MobileProviderRepository } from './services/mobile-provider-repository';
export { IMobileSecretCipherService, MobileSecretCipherService } from './services/mobile-secret-cipher.service';
export { MobileSkillRepository } from './services/mobile-skill-repository';
export { IMobileSnippetRepository, MobileSnippetRepository } from './services/mobile-snippet-repository';
export { IRecentSessionsRepository, RecentSessionsRepository } from './services/recent-sessions-repository';
export type { IRecentSession, IRecentSessionKind } from './services/recent-sessions-repository';
export type { IMobileCredential, IMobileCredentialType, IMobileHost, IMobileHostFull, IMobileHostSettings, IMobileHostType, IMobileIdentity, IMobileIdentityFull, IMobileKnownHost, IMobileProxy, IMobileSshKey, IMobileSshKeyFull, ISshKeyAlgorithm, ISshKeySource } from './types';
