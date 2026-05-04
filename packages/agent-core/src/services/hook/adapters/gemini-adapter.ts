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

import type { ExternalAgentType, IAgentHookDefinition } from '@termlnk/agent';
import { BaseConfigFileAdapter } from './base-config-adapter';

export class GeminiHookAdapter extends BaseConfigFileAdapter {
  readonly agentType: ExternalAgentType = 'gemini';

  readonly definition: IAgentHookDefinition = {
    name: 'gemini',
    displayName: 'Gemini',
    configDir: '.gemini',
    configFile: 'settings.json',
    disableEnvVar: 'TERMLNK_GEMINI_HOOKS_DISABLED',
    format: { type: 'nested', defaultTimeoutSec: 10 },
    events: [
      { agentEvent: 'SessionStart', termlnkEvent: 'session-start' },
      { agentEvent: 'BeforeAgent', termlnkEvent: 'prompt-submit' },
      { agentEvent: 'AfterAgent', termlnkEvent: 'stop' },
      { agentEvent: 'SessionEnd', termlnkEvent: 'session-end' },
      { agentEvent: 'BeforeTool', termlnkEvent: 'pre-tool-use' },
      { agentEvent: 'AfterTool', termlnkEvent: 'post-tool-use' },
      { agentEvent: 'Notification', termlnkEvent: 'notification' },
      // Gemini's compaction event is named `PreCompress` (not PreCompact).
      { agentEvent: 'PreCompress', termlnkEvent: 'pre-compact' },
    ],
  };
}
