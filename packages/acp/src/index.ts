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

export {
  ACP_CLIENT_NAME,
  ACP_CLIENT_VERSION,
  ACP_CORE_PLUGIN_NAME,
  ACP_PLUGIN_NAME,
  ACP_SESSION_TYPE,
  AGENT_TERMINATE_GRACE_MS,
  DEFAULT_HANDSHAKE_TIMEOUT_MS,
  DEFAULT_PROBE_TIMEOUT_MS,
} from './common/constants';
export { ACP_PLUGIN_CONFIG_KEY, defaultPluginConfig } from './controllers/config.schema';
export type { ACPDefaultCwdStrategy, IACPPluginConfig } from './controllers/config.schema';
export { ACP_PROVIDER_CATALOG } from './data/provider-catalog';
export type {
  IACPCommandsUpdateEvent,
  IACPErrorEvent,
  IACPHistoryReplayEndEvent,
  IACPHistoryReplayStartEvent,
  IACPMessageUpsertEvent,
  IACPModelsUpdateEvent,
  IACPModeUpdateEvent,
  IACPPartAppendEvent,
  IACPPermissionOption,
  IACPPermissionRequest,
  IACPPermissionRequestedEvent,
  IACPPermissionResolvedEvent,
  IACPPlanEvent,
  IACPSessionStatusEvent,
  IACPStreamEvent,
  IACPTitleUpdateEvent,
  IACPToolUpdateEvent,
  IACPTurnCompleteEvent,
} from './models/acp-event';
export type {
  ACPProviderAvailability,
  IACPProviderDescriptor,
  IACPProviderStatus,
} from './models/acp-provider';
export type {
  ACPSessionStatus,
  IACPAvailableCommand,
  IACPPromptBlock,
  IACPSessionInfo,
  IACPSessionMode,
  IACPSessionModel,
  IACPSessionState,
  ICreateACPSessionParams,
} from './models/acp-session';
export { ACPPlugin } from './plugin';
export { IACPDiscoveryService } from './services/acp-discovery.service';
export { IACPSessionService } from './services/acp-session.service';
