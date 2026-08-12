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

export { ACP_CORE_PLUGIN_CONFIG_KEY, defaultPluginConfig } from './controllers/config.schema';
export type { IACPCorePluginConfig } from './controllers/config.schema';
export { ACP_CORE_PLUGIN_NAME, ACPCorePlugin } from './plugin';
export { ACPDiscoveryService } from './services/discovery/acp-discovery.service';
export { resolveLoginShellEnv } from './services/discovery/login-shell-env';
export {
  isOnDemandLauncher,
  probeProviderAvailability,
  resolveBinaryOnPath,
} from './services/discovery/probe-binary';
export { ACPSessionStore } from './services/persistence/acp-session-store';
export { ACPConnection } from './services/session/acp-connection';
export { ACPSessionService } from './services/session/acp-session.service';
export {
  createTranslatorState,
  reduceStreamEvents,
  translateSessionUpdate,
} from './services/session/translate/session-update';
export { mapToolStatus, translateToolCall, translateToolCallUpdate } from './services/session/translate/tool-call';
