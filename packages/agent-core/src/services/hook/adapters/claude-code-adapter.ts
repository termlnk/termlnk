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
import { ClaudeCodeWireFormatter, parseClaudeAskUserQuestion } from '../wire-formatters';
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

  readonly definition: IAgentHookDefinition;

  /**
   * @param logService       Shared log service
   * @param launcherPath     Absolute path to the hook launcher binary
   * @param keyboardInjectionAvailable
   *   When `true` (macOS with Accessibility), AskUserQuestion installs as
   *   a non-blocking monitoring hook — Claude Code renders its own CLI
   *   TUI picker and the Dynamic Island mirrors it, with either side's
   *   answer replayed into the other via keyboard event synthesis. When
   *   `false` (Windows/Linux, or permission denied), AskUserQuestion
   *   stays blocking and the island is the sole responder, matching the
   *   pre-injection behaviour. Defaults to `false` for safety.
   */
  constructor(
    logService: ILogService,
    launcherPath: string,
    keyboardInjectionAvailable: boolean = false
  ) {
    super(logService, launcherPath);
    this.definition = this._buildDefinition(keyboardInjectionAvailable);
  }

  private _buildDefinition(keyboardInjectionAvailable: boolean): IAgentHookDefinition {
    // AskUserQuestion mode — non-blocking lets Claude's CLI TUI render
    // natively while the island mirrors picks via keystroke injection;
    // blocking makes the island the sole responder (see constructor doc).
    const askUserQuestionMode = keyboardInjectionAvailable
      ? { timeoutSec: 5, async: true }
      : { timeoutSec: 120, blocking: true };

    return {
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

        // AskUserQuestion — see askUserQuestionMode above.
        {
          agentEvent: 'PreToolUse',
          termlnkEvent: 'ask-user-question',
          matcher: 'AskUserQuestion',
          ...askUserQuestionMode,
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
    return parseClaudeAskUserQuestion(toolInput);
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
