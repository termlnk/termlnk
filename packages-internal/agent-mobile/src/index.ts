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

export { AGENT_MOBILE_PLUGIN_CONFIG_KEY } from './controllers/config.schema';
export type { IAgentMobileConfig } from './controllers/config.schema';
export type { IChatUsage, IErrorPart, IImagePart, IMobileChatMessage, IMobileImageAttachment, IMobileMessagePart, IMobileSendMessageOptions, ITextPart, IThinkingPart, MobileAgentStatus, MobileChatRole, MobileThinkingLevel } from './models/message';
export type { IKnownModelSeed, IKnownProviderTemplate, IMobileModelConfig, IMobileProviderConfig, IMobileProviderGroup, MobileApiType } from './models/provider';
export { KNOWN_PROVIDER_TEMPLATES } from './models/provider';
export type { IMobileChatSession } from './models/session';
export { AGENT_MOBILE_PLUGIN_NAME, AgentMobilePlugin } from './plugin';
export { IMobileChatService } from './services/chat.service';
export type { IMobileChatService as IMobileChatServiceType } from './services/chat.service';
export { IMobileProviderService } from './services/provider.service';
export type { IMobileProviderService as IMobileProviderServiceType } from './services/provider.service';
export { IMobileSessionService } from './services/session.service';
export type { IMobileSessionService as IMobileSessionServiceType } from './services/session.service';
