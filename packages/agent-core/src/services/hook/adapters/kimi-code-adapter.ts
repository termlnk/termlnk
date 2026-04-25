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

import type { AgentHookEventType, ExternalAgentType, IAgentHookAdapter, IAgentHookDefinition, IAskUserQuestionSet, IPermissionDecision } from '@termlnk/agent';
import type { ILogService } from '@termlnk/core';
import type { Observable } from 'rxjs';
import type { IAgentWireFormatter } from '../wire-formatters';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { TERMLNK_HOOK_MARKER } from '@termlnk/agent';
import { Disposable, toDisposable } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';
import { GenericWireFormatter, parseUniformQuestionSet } from '../wire-formatters';

const KIMI_CONFIG_DIR = join(homedir(), '.kimi');
const KIMI_CONFIG_FILE = join(KIMI_CONFIG_DIR, 'config.toml');
const TERMLNK_BLOCK_BEGIN = '# === TERMLNK_HOOK_BEGIN ===';
const TERMLNK_BLOCK_END = '# === TERMLNK_HOOK_END ===';
/** Matches the entire termlnk-managed block (with surrounding blank lines). */
const TERMLNK_BLOCK_PATTERN = /\n*# === TERMLNK_HOOK_BEGIN ===[\s\S]*?# === TERMLNK_HOOK_END ===\n*/g;

/**
 * Kimi Code adapter — installs hooks via `~/.kimi/config.toml`.
 *
 * Kimi uses a TOML array-of-tables (`[[hooks]]`) format, distinct from the
 * JSON-based formats used by the other adapters, so this implementation does
 * not extend BaseConfigFileAdapter. Hooks are written inside a fenced block
 * (`TERMLNK_HOOK_BEGIN` ... `TERMLNK_HOOK_END`) so we can remove them on
 * uninstall without parsing TOML.
 *
 * Kimi delivers the hook payload via stdin, which we forward to the termlnk
 * HTTP hook server using the same env-var convention as the other adapters.
 * Kimi does not expose a blocking permission-request hook, so all entries are
 * fire-and-forget.
 *
 * Spec: https://moonshotai.github.io/kimi-cli/zh/customization/hooks.html
 */
export class KimiCodeHookAdapter extends Disposable implements IAgentHookAdapter {
  readonly agentType: ExternalAgentType = 'kimi-code';

  readonly definition: IAgentHookDefinition = {
    name: 'kimi-code',
    displayName: 'Kimi Code',
    configDir: '.kimi',
    configFile: 'config.toml',
    disableEnvVar: 'TERMLNK_KIMI_HOOKS_DISABLED',
    // Kimi's TOML format is unique; the format tag is a stub used only to
    // satisfy IAgentHookDefinition — install/uninstall are fully overridden.
    format: { type: 'plugin-config' },
    events: [
      { agentEvent: 'SessionStart', termlnkEvent: 'session-start' },
      { agentEvent: 'SessionEnd', termlnkEvent: 'session-end' },
      { agentEvent: 'UserPromptSubmit', termlnkEvent: 'prompt-submit' },
      { agentEvent: 'Stop', termlnkEvent: 'stop' },
      { agentEvent: 'StopFailure', termlnkEvent: 'stop-failure' },
      { agentEvent: 'Notification', termlnkEvent: 'notification' },
      { agentEvent: 'PreToolUse', termlnkEvent: 'pre-tool-use' },
      { agentEvent: 'PostToolUse', termlnkEvent: 'post-tool-use' },
      { agentEvent: 'PostToolUseFailure', termlnkEvent: 'post-tool-use-failure' },
      { agentEvent: 'SubagentStart', termlnkEvent: 'subagent-start' },
      { agentEvent: 'SubagentStop', termlnkEvent: 'subagent-stop' },
      { agentEvent: 'PreCompact', termlnkEvent: 'pre-compact' },
      { agentEvent: 'PostCompact', termlnkEvent: 'post-compact' },
      // Kimi surfaces AskUserQuestion through PreToolUse + matcher=AskUserQuestion.
      // Monitor only — Kimi's TUI handles the pick natively.
      {
        agentEvent: 'PreToolUse',
        termlnkEvent: 'ask-user-question',
        matcher: 'AskUserQuestion',
        timeoutSec: 5,
        async: true,
      },
    ],
  };

  private readonly _installed$ = new BehaviorSubject<boolean>(false);
  readonly installed$: Observable<boolean> = this._installed$.asObservable();

  private readonly _wireFormatter: IAgentWireFormatter = new GenericWireFormatter();

  constructor(
    private readonly _logService: ILogService,
    private readonly _launcherPath: string
  ) {
    super();
    this.disposeWithMe(toDisposable(() => {
      this._installed$.complete();
    }));
  }

  parseQuestion(toolName: string, toolInput: Record<string, unknown>): IAskUserQuestionSet | null {
    if (toolName !== 'AskUserQuestion') {
      return null;
    }
    return parseUniformQuestionSet(toolInput);
  }

  formatResponse(decision: IPermissionDecision): string {
    return this._wireFormatter.formatResponse(decision);
  }

  async install(_port: number, _token: string): Promise<void> {
    if (!existsSync(KIMI_CONFIG_DIR)) {
      this._logService.log(
        '[KimiCodeAdapter]',
        `Config dir ${KIMI_CONFIG_DIR} does not exist, skipping install`
      );
      return;
    }

    try {
      const stripped = this._stripTermlnkBlock(this._readConfig());
      const block = this._buildHooksBlock();
      const separator = stripped === '' || stripped.endsWith('\n') ? '' : '\n';
      this._writeConfig(`${stripped}${separator}${block}\n`);
      this._installed$.next(true);
      this._logService.log(
        '[KimiCodeAdapter]',
        `Hooks installed at ${KIMI_CONFIG_FILE}`
      );
    } catch (err) {
      this._logService.warn('[KimiCodeAdapter]', 'Failed to install hooks:', err);
    }
  }

  async uninstall(): Promise<void> {
    if (!existsSync(KIMI_CONFIG_FILE)) {
      this._installed$.next(false);
      return;
    }

    try {
      const stripped = this._stripTermlnkBlock(this._readConfig());
      this._writeConfig(stripped);
      this._installed$.next(false);
      this._logService.log('[KimiCodeAdapter]', `Hooks uninstalled from ${KIMI_CONFIG_FILE}`);
    } catch (err) {
      this._logService.warn('[KimiCodeAdapter]', 'Failed to uninstall hooks:', err);
    }
  }

  async isAvailable(): Promise<boolean> {
    return existsSync(KIMI_CONFIG_DIR);
  }

  getEnvOverrides(sessionId: string, port: number, token: string): Record<string, string> {
    return {
      TERMLNK_SESSION_ID: sessionId,
      TERMLNK_HOOK_PORT: String(port),
      TERMLNK_HOOK_TOKEN: token,
      TERMLNK_HOOK_URL: `http://127.0.0.1:${port}/hook`,
    };
  }

  mapEvent(agentEventName: string): AgentHookEventType | undefined {
    const mapping = this.definition.events.find((e) => e.agentEvent === agentEventName);
    return mapping?.termlnkEvent;
  }

  // ---------------------------------------------------------------------------
  // TOML config block helpers
  // ---------------------------------------------------------------------------

  private _readConfig(): string {
    if (!existsSync(KIMI_CONFIG_FILE)) {
      return '';
    }
    try {
      return readFileSync(KIMI_CONFIG_FILE, 'utf-8');
    } catch {
      return '';
    }
  }

  private _writeConfig(content: string): void {
    if (!existsSync(KIMI_CONFIG_DIR)) {
      mkdirSync(KIMI_CONFIG_DIR, { recursive: true });
    }
    writeFileSync(KIMI_CONFIG_FILE, content, 'utf-8');
  }

  /**
   * Remove any previous termlnk-managed block, preserving user content.
   */
  private _stripTermlnkBlock(content: string): string {
    return content
      .replace(TERMLNK_BLOCK_PATTERN, '\n')
      .replace(/\n{3,}/g, '\n\n');
  }

  private _buildHooksBlock(): string {
    const lines: string[] = [TERMLNK_BLOCK_BEGIN];
    for (const mapping of this.definition.events) {
      const command = this._buildHookCommand(mapping.termlnkEvent);
      lines.push('');
      lines.push('[[hooks]]');
      lines.push(`# ${TERMLNK_HOOK_MARKER}`);
      lines.push(`event = "${mapping.agentEvent}"`);
      if (mapping.matcher !== undefined) {
        lines.push(`matcher = "${mapping.matcher}"`);
      }
      // TOML literal string `'…'` preserves the value verbatim — the
      // launcher path may contain spaces on some systems (e.g., Windows
      // user names) so we keep the quoted absolute path as-is.
      lines.push(`command = '${command}'`);
      lines.push('timeout = 5');
    }
    lines.push(TERMLNK_BLOCK_END);
    return lines.join('\n');
  }

  /**
   * Build the launcher invocation Kimi runs for each hook.
   *
   * Kimi pipes the hook payload (JSON) to stdin; the launcher forwards it
   * to the Termlnk HTTP hook server, discovering the port via env vars or
   * `<configPath>/runtime.json`.
   */
  private _buildHookCommand(event: AgentHookEventType): string {
    const quoted = `"${this._launcherPath}"`;
    return `${quoted} --agent kimi-code --event ${event}`;
  }
}
