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
import type { IAgentWireFormatter } from '../wire-formatters';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CodexWireFormatter, parseCodexRequestUserInput } from '../wire-formatters';
import { BaseConfigFileAdapter } from './base-config-adapter';

export class CodexHookAdapter extends BaseConfigFileAdapter {
  readonly agentType: ExternalAgentType = 'codex';

  protected override readonly _wireFormatter: IAgentWireFormatter = new CodexWireFormatter();

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
      // Blocking picker — Codex runs the hook and waits for a JSON body
      // shaped `{ answers: { [id]: { answers: [...] } } }` on stdout.
      {
        agentEvent: 'PreToolUse',
        termlnkEvent: 'ask-user-question',
        matcher: 'request_user_input',
        timeoutSec: 120,
        blocking: true,
      },
    ],
  };

  override parseQuestion(toolName: string, toolInput: Record<string, unknown>): IAskUserQuestionSet | null {
    if (toolName !== 'request_user_input') {
      return null;
    }
    return parseCodexRequestUserInput(toolInput);
  }

  /**
   * Override install to add codex_hooks feature flag in config.toml.
   * Codex requires `codex_hooks = true` under [features] to enable hooks.
   */
  override async install(port: number, token: string): Promise<void> {
    await super.install(port, token);
    this._enableCodexHooksConfig();
  }

  /**
   * Override uninstall to remove codex_hooks feature flag from config.toml.
   */
  override async uninstall(): Promise<void> {
    await super.uninstall();
    this._disableCodexHooksConfig();
  }

  private _enableCodexHooksConfig(): void {
    const configDir = this._resolveConfigDir();
    const configPath = join(configDir, 'config.toml');

    try {
      let content = '';
      if (existsSync(configPath)) {
        content = readFileSync(configPath, 'utf-8');
      }

      if (content.includes('codex_hooks')) {
        // Replace existing value
        content = content.replace(/codex_hooks\s*=\s*\w+/, 'codex_hooks = true');
      } else if (content.includes('[features]')) {
        content = content.replace('[features]', '[features]\ncodex_hooks = true');
      } else {
        content = `${content}\n[features]\ncodex_hooks = true\n`;
      }

      writeFileSync(configPath, content, 'utf-8');
      this._logService.log('[CodexAdapter]', `Enabled codex_hooks in ${configPath}`);
    } catch (err) {
      this._logService.warn('[CodexAdapter]', 'Failed to enable codex_hooks in config.toml:', err);
    }
  }

  private _disableCodexHooksConfig(): void {
    const configDir = this._resolveConfigDir();
    const configPath = join(configDir, 'config.toml');

    try {
      if (!existsSync(configPath)) {
        return;
      }

      let content = readFileSync(configPath, 'utf-8');
      if (!content.includes('codex_hooks')) {
        return;
      }

      content = content.replace(/\n?codex_hooks\s*=\s*\w+/, '');
      writeFileSync(configPath, content, 'utf-8');
      this._logService.log('[CodexAdapter]', 'Removed codex_hooks from config.toml');
    } catch (err) {
      this._logService.warn('[CodexAdapter]', 'Failed to remove codex_hooks from config.toml:', err);
    }
  }
}
