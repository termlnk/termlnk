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

import type { IPermissionDecision } from '@termlnk/agent';
import type { IAgentWireFormatter } from './wire-formatter';

/**
 * Claude Code wire formatter.
 *
 * Emits `hookSpecificOutput.decision.behavior` of allow or deny for the
 * classic PermissionRequest path. AskUserQuestion is no longer answered
 * via hook response — the hook server releases `{}` immediately and the
 * Claude Code CLI TUI handles the pick natively.
 */
export class ClaudeCodeWireFormatter implements IAgentWireFormatter {
  formatResponse(decision: IPermissionDecision): string {
    const inner = decision.kind === 'allow'
      ? { behavior: 'allow' }
      : { behavior: 'deny', message: 'Denied by user in Termlnk' };
    return JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: inner },
    });
  }
}
