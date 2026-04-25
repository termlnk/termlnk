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

import type { ExternalAgentType, IAgentHookDefinition, IAskUserQuestionSet } from '@termlnk/agent';
import type { ILogService } from '@termlnk/core';
import type { IAgentWireFormatter } from '../wire-formatters';
import { existsSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ClaudeCodeWireFormatter, parseUniformQuestionSet } from '../wire-formatters';
import { BaseConfigFileAdapter } from './base-config-adapter';

/**
 * Claude Code adapter — installs hooks via `~/.claude/settings.json`.
 *
 * Uses Claude Code's native hook system. Each event is written as a nested
 * hook entry with a curl callback to the termlnk HTTP hook server. The
 * environment variables `TERMLNK_HOOK_PORT` and `TERMLNK_HOOK_TOKEN` are
 * resolved at runtime by the shell, so the config file survives app restarts.
 */
export class ClaudeCodeHookAdapter extends BaseConfigFileAdapter {
  readonly agentType: ExternalAgentType = 'claude-code';

  protected override readonly _wireFormatter: IAgentWireFormatter = new ClaudeCodeWireFormatter();

  readonly definition: IAgentHookDefinition = {
    name: 'claude-code',
    displayName: 'Claude Code',
    configDir: '.claude',
    configFile: 'settings.json',
    disableEnvVar: 'TERMLNK_CLAUDE_HOOKS_DISABLED',
    format: { type: 'nested', defaultTimeoutSec: 10 },
    // Order is for readability only — all entries become independent
    // matcher groups in `~/.claude/settings.json`.
    events: [
      // Lifecycle — fire-and-forget, cheap.
      { agentEvent: 'SessionStart', termlnkEvent: 'session-start' },
      { agentEvent: 'SessionEnd', termlnkEvent: 'session-end', timeoutSec: 1 },
      { agentEvent: 'UserPromptSubmit', termlnkEvent: 'prompt-submit' },
      { agentEvent: 'Stop', termlnkEvent: 'stop' },
      { agentEvent: 'StopFailure', termlnkEvent: 'stop-failure' },
      { agentEvent: 'PreCompact', termlnkEvent: 'pre-compact' },
      { agentEvent: 'PostCompact', termlnkEvent: 'post-compact' },

      // Tool monitoring — async so Claude never blocks on our reporting.
      { agentEvent: 'PreToolUse', termlnkEvent: 'pre-tool-use', matcher: '*', timeoutSec: 5, async: true },
      { agentEvent: 'PostToolUse', termlnkEvent: 'post-tool-use', matcher: '*' },
      { agentEvent: 'PostToolUseFailure', termlnkEvent: 'post-tool-use-failure', matcher: '*' },

      // AskUserQuestion — monitor only. The hook server releases `{}`
      // immediately so Claude Code's CLI TUI handles the pick natively;
      // the island just shows the pet's Question state.
      {
        agentEvent: 'PreToolUse',
        termlnkEvent: 'ask-user-question',
        matcher: 'AskUserQuestion',
        timeoutSec: 5,
        async: true,
      },

      // Blocking permission prompts (Bash, Edit, WebFetch, …).
      { agentEvent: 'PermissionRequest', termlnkEvent: 'permission-request', matcher: '*', timeoutSec: 120, blocking: true },

      // Subagent lifecycle — dedicated events, NOT notification (which would
      // pop a desktop toast on every Agent completion).
      { agentEvent: 'SubagentStart', termlnkEvent: 'subagent-start' },
      { agentEvent: 'SubagentStop', termlnkEvent: 'subagent-stop' },

      // User-facing notifications from Claude's own channel — stay mapped
      // to notification because these are the dialogs Claude itself opens.
      { agentEvent: 'Notification', termlnkEvent: 'notification', matcher: '*' },
    ],
  };

  constructor(logService: ILogService, launcherPath: string) {
    super(logService, launcherPath);
  }

  override async install(port: number, token: string): Promise<void> {
    this._removeLegacyWrapper();
    await super.install(port, token);
  }

  override async uninstall(): Promise<void> {
    this._removeLegacyWrapper();
    await super.uninstall();
  }

  override parseQuestion(toolName: string, toolInput: Record<string, unknown>): IAskUserQuestionSet | null {
    if (toolName !== 'AskUserQuestion') {
      return null;
    }
    return parseUniformQuestionSet(toolInput);
  }

  /**
   * Remove old wrapper script from the pre-refactor PATH-interception approach.
   */
  private _removeLegacyWrapper(): void {
    try {
      const legacyPath = join(homedir(), '.config', 'termlnk', 'bin', 'claude');
      if (existsSync(legacyPath)) {
        unlinkSync(legacyPath);
        this._logService.log('[ClaudeCodeAdapter]', `Removed legacy wrapper at ${legacyPath}`);
      }
    } catch {
      // Best-effort cleanup
    }
  }
}
