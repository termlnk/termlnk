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

import type { AgentHookEventType, ExternalAgentType, IAgentHookAdapter, IAgentHookDefinition, IAgentHookEventMapping, IAskUserQuestion, IAskUserQuestionSet, IPermissionDecision } from '@termlnk/agent';
import type { ILogService } from '@termlnk/core';
import type { Observable } from 'rxjs';
import type { IAgentWireFormatter } from '../wire-formatters';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { TERMLNK_HOOK_MARKER } from '@termlnk/agent';
import { Disposable, toDisposable } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';
import { GenericWireFormatter } from '../wire-formatters';

/**
 * Abstract base class for agents that install hooks via config files.
 *
 * Handles the common logic of reading/writing JSON config files, building
 * hook payloads in flat or nested format, and generating launcher callback
 * commands. Subclasses only need to supply the {@link IAgentHookDefinition}.
 *
 * Hook commands delegate to the bundled launcher at
 * `<configPath>/bin/termlnk-hook` (installed by {@link IHookLauncherService}),
 * which resolves the running Termlnk HTTP hook server via env vars
 * (internal PTY) or `<configPath>/runtime.json` (external terminals).
 */
export abstract class BaseConfigFileAdapter extends Disposable implements IAgentHookAdapter {
  abstract readonly agentType: ExternalAgentType;
  abstract readonly definition: IAgentHookDefinition;

  private readonly _installed$ = new BehaviorSubject<boolean>(false);
  readonly installed$: Observable<boolean> = this._installed$.asObservable();

  /**
   * Default wire formatter. Subclasses that need agent-specific serialisation
   * (Claude Code's `updatedInput.answers`, etc.) override this field with
   * their own formatter instance.
   */
  protected readonly _wireFormatter: IAgentWireFormatter = new GenericWireFormatter();

  constructor(
    protected readonly _logService: ILogService,
    protected readonly _launcherPath: string
  ) {
    super();
    this.disposeWithMe(toDisposable(() => {
      this._installed$.complete();
    }));
  }

  /**
   * Default implementation: no question parsing. Subclasses that speak an
   * AskUserQuestion-like tool override to return a structured question set.
   */
  parseQuestion(_toolName: string, _toolInput: Record<string, unknown>): IAskUserQuestionSet | null {
    return null;
  }

  formatResponse(
    decision: IPermissionDecision,
    context: {
      readonly isQuestion: boolean;
      readonly toolInput?: Record<string, unknown>;
      readonly question?: IAskUserQuestion;
      readonly questionSet?: IAskUserQuestionSet;
    }
  ): string {
    return this._wireFormatter.formatResponse(decision, context);
  }

  async install(_port: number, _token: string): Promise<void> {
    const configDir = this._resolveConfigDir();
    const filePath = join(configDir, this.definition.configFile);

    if (!existsSync(configDir)) {
      this._logService.log(
        `[${this.definition.displayName}Adapter]`,
        `Config dir ${configDir} does not exist, skipping install`
      );
      return;
    }

    try {
      const existing = this._readConfigFile(filePath);
      const hooks = (existing.hooks as Record<string, unknown>) ?? {};

      // Remove any existing termlnk-managed entries
      this._removeOurEntries(hooks);

      // Add new termlnk entries
      const newHooks = this._buildHooksPayload();
      for (const [event, value] of Object.entries(newHooks)) {
        const existingEntries = (hooks[event] as unknown[]) ?? [];
        hooks[event] = [...existingEntries, ...(value as unknown[])];
      }

      existing.hooks = hooks;
      if (this.definition.format.type === 'flat') {
        existing.version = 1;
      }

      this._writeConfigFile(filePath, existing);
      this._installed$.next(true);
      this._logService.log(
        `[${this.definition.displayName}Adapter]`,
        `Hooks installed at ${filePath}`
      );
    } catch (err) {
      this._logService.warn(
        `[${this.definition.displayName}Adapter]`,
        'Failed to install hooks:',
        err
      );
    }
  }

  async uninstall(): Promise<void> {
    const configDir = this._resolveConfigDir();
    const filePath = join(configDir, this.definition.configFile);

    if (!existsSync(filePath)) {
      this._installed$.next(false);
      return;
    }

    try {
      const existing = this._readConfigFile(filePath);
      const hooks = (existing.hooks as Record<string, unknown>) ?? {};

      this._removeOurEntries(hooks);

      // Clean up empty event keys
      for (const [key, value] of Object.entries(hooks)) {
        if (Array.isArray(value) && value.length === 0) {
          delete hooks[key];
        }
      }

      existing.hooks = Object.keys(hooks).length > 0 ? hooks : undefined;
      this._writeConfigFile(filePath, existing);
      this._installed$.next(false);
      this._logService.log(
        `[${this.definition.displayName}Adapter]`,
        `Hooks uninstalled from ${filePath}`
      );
    } catch (err) {
      this._logService.warn(
        `[${this.definition.displayName}Adapter]`,
        'Failed to uninstall hooks:',
        err
      );
    }
  }

  async isAvailable(): Promise<boolean> {
    return existsSync(this._resolveConfigDir());
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
    const mapping = this.definition.events.find(
      (e) => e.agentEvent === agentEventName
    );
    return mapping?.termlnkEvent;
  }

  protected _resolveConfigDir(): string {
    if (this.definition.configDirEnvOverride) {
      const envValue = process.env[this.definition.configDirEnvOverride];
      if (envValue) {
        return envValue;
      }
    }
    return join(homedir(), this.definition.configDir);
  }

  private _readConfigFile(filePath: string): Record<string, unknown> {
    if (!existsSync(filePath)) {
      return {};
    }
    try {
      const raw = readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private _writeConfigFile(filePath: string, data: Record<string, unknown>): void {
    // Remove undefined values before serializing
    const cleaned = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, `${JSON.stringify(cleaned, null, 2)}\n`, 'utf-8');
  }

  private _removeOurEntries(hooks: Record<string, unknown>): void {
    const format = this.definition.format;

    for (const [event, value] of Object.entries(hooks)) {
      if (!Array.isArray(value)) {
        continue;
      }

      if (format.type === 'flat') {
        hooks[event] = value.filter((entry: Record<string, unknown>) => {
          const cmd = entry.command as string | undefined;
          return !cmd || !cmd.includes(TERMLNK_HOOK_MARKER);
        });
      } else if (format.type === 'nested') {
        hooks[event] = value.filter((group: Record<string, unknown>) => {
          const hookList = group.hooks as Array<Record<string, unknown>> | undefined;
          if (!hookList) {
            return true;
          }
          return !hookList.every((h) => {
            const cmd = h.command as string | undefined;
            return cmd && cmd.includes(TERMLNK_HOOK_MARKER);
          });
        });
      }
    }
  }

  /**
   * Group entries by `agentEvent`, accumulating on collision. One event
   * may map to several entries (Claude Code's `PreToolUse` routes both
   * `matcher: '*'` and `matcher: 'AskUserQuestion'`), so a naive
   * assignment would silently drop all but the last.
   */
  private _buildHooksPayload(): Record<string, unknown[]> {
    const result: Record<string, unknown[]> = {};

    for (const mapping of this.definition.events) {
      const entry = this._buildEventEntry(mapping);
      if (entry) {
        (result[mapping.agentEvent] ??= []).push(entry);
      }
    }

    return result;
  }

  /**
   * Returns `null` for `plugin-config` agents — they inject hooks via
   * their own plugin file rather than the shared config block.
   */
  private _buildEventEntry(mapping: IAgentHookEventMapping): Record<string, unknown> | null {
    const command = this._buildHookCommand(mapping.termlnkEvent);
    const format = this.definition.format;

    if (format.type === 'flat') {
      return { command };
    }

    if (format.type === 'nested') {
      // `timeout` is in seconds across all nested-format agents.
      const hookEntry: Record<string, unknown> = {
        type: 'command',
        command,
        timeout: mapping.timeoutSec ?? format.defaultTimeoutSec,
      };
      if (mapping.async === true) {
        hookEntry.async = true;
      }
      const group: Record<string, unknown> = { hooks: [hookEntry] };
      if (mapping.matcher !== undefined) {
        group.matcher = mapping.matcher;
      }
      return group;
    }

    return null;
  }

  /**
   * Build the shell command the agent runs for a single hook event.
   *
   * Yields a single-line, shell-quoted invocation of
   * `~/.termlnk/bin/termlnk-hook --agent <name> --event <type>` with the
   * `TERMLNK_HOOK` marker comment so the uninstall path can identify and
   * remove termlnk-managed entries.
   */
  protected _buildHookCommand(event: AgentHookEventType): string {
    const agent = this.definition.name;
    const isWindows = platform() === 'win32';
    // Windows agents (codex, etc.) execute config commands through cmd.exe,
    // which does not understand POSIX quoting; quote with double-quotes
    // instead. POSIX shells accept single-quoted paths as well.
    const quotedLauncher = isWindows
      ? `"${this._launcherPath}"`
      : `'${this._launcherPath}'`;
    return `${quotedLauncher} --agent ${agent} --event ${event} # ${TERMLNK_HOOK_MARKER}`;
  }
}
