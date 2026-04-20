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

export class CursorHookAdapter extends BaseConfigFileAdapter {
  readonly agentType: ExternalAgentType = 'cursor';

  readonly definition: IAgentHookDefinition = {
    name: 'cursor',
    displayName: 'Cursor',
    configDir: '.cursor',
    configFile: 'hooks.json',
    disableEnvVar: 'TERMLNK_CURSOR_HOOKS_DISABLED',
    format: { type: 'flat' },
    events: [
      { agentEvent: 'beforeSubmitPrompt', termlnkEvent: 'prompt-submit' },
      { agentEvent: 'stop', termlnkEvent: 'stop' },
      { agentEvent: 'afterAgentResponse', termlnkEvent: 'stop' },
      { agentEvent: 'beforeShellExecution', termlnkEvent: 'pre-tool-use' },
      { agentEvent: 'afterShellExecution', termlnkEvent: 'post-tool-use' },
    ],
  };
}
