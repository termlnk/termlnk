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
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseUniformQuestionSet } from '../wire-formatters';
import { BaseConfigFileAdapter } from './base-config-adapter';

/**
 * Anchored at the start of a line (multiline), optionally consuming a
 * trailing newline so the deleted entry does not leave a blank line behind.
 * `[ \t]` instead of `\s` avoids eating surrounding line breaks, and
 * `[^\n]*` matches the value regardless of whether it is bare (`true`),
 * quoted (`"true"`), or anything else the user typed.
 */
const LEGACY_CODEX_HOOKS_LINE = /^[ \t]*codex_hooks[ \t]*=[^\n]*\n?/gm;

/**
 * Pure transform: strip every `codex_hooks = ...` line from a config.toml
 * body. Returns `null` if nothing changed so callers can skip the write.
 * Exported for unit testing — the surrounding adapter methods only handle
 * filesystem and logging.
 */
export function stripLegacyCodexHooksFlag(content: string): string | null {
  if (!content.includes('codex_hooks')) {
    return null;
  }
  const cleaned = content.replace(LEGACY_CODEX_HOOKS_LINE, '');
  return cleaned === content ? null : cleaned;
}

export class CodexHookAdapter extends BaseConfigFileAdapter {
  readonly agentType: ExternalAgentType = 'codex';

  readonly definition: IAgentHookDefinition = {
    name: 'codex',
    displayName: 'Codex',
    configDir: '.codex',
    configFile: 'hooks.json',
    configDirEnvOverride: 'CODEX_HOME',
    disableEnvVar: 'TERMLNK_CODEX_HOOKS_DISABLED',
    format: { type: 'nested', defaultTimeoutSec: 10 },
    events: [
      { agentEvent: 'SessionStart', termlnkEvent: 'session-start' },
      { agentEvent: 'UserPromptSubmit', termlnkEvent: 'prompt-submit' },
      { agentEvent: 'Stop', termlnkEvent: 'stop' },
      // AskUserQuestion — monitor only. The hook server releases `{}`
      // immediately so Codex's TUI handles the pick natively. No `async`
      // flag — Codex's hook schema rejects unknown fields and skips the
      // entry entirely.
      {
        agentEvent: 'PreToolUse',
        termlnkEvent: 'ask-user-question',
        matcher: 'request_user_input',
        timeoutSec: 5,
      },
    ],
  };

  override parseQuestion(toolName: string, toolInput: Record<string, unknown>): IAskUserQuestionSet | null {
    if (toolName !== 'request_user_input') {
      return null;
    }
    return parseUniformQuestionSet(toolInput);
  }

  override async install(port: number, token: string): Promise<void> {
    await super.install(port, token);
    this._cleanupLegacyCodexHooksFlag();
  }

  override async uninstall(): Promise<void> {
    await super.uninstall();
    this._cleanupLegacyCodexHooksFlag();
  }

  /**
   * Older Termlnk releases wrote `[features].codex_hooks = true` to enable
   * Codex lifecycle hooks. Codex has renamed the flag to `hooks` (Stable,
   * defaults to true), so the old name now prints a deprecation warning on
   * every launch. Strip the legacy line whenever we install/uninstall so
   * upgraded users stop seeing the warning. No replacement is written
   * because the new flag is on by default.
   */
  private _cleanupLegacyCodexHooksFlag(): void {
    const configDir = this._resolveConfigDir();
    const configPath = join(configDir, 'config.toml');

    try {
      if (!existsSync(configPath)) {
        return;
      }

      const cleaned = stripLegacyCodexHooksFlag(readFileSync(configPath, 'utf-8'));
      if (cleaned === null) {
        return;
      }

      writeFileSync(configPath, cleaned, 'utf-8');
      this._logService.log('[CodexAdapter]', `Removed legacy codex_hooks flag from ${configPath}`);
    } catch (err) {
      this._logService.warn('[CodexAdapter]', 'Failed to clean legacy codex_hooks from config.toml:', err);
    }
  }
}
