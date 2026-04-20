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

import type { AgentHookEventType, ExternalAgentType, IAgentHookAdapter, IAgentHookDefinition, IAskUserQuestion, IPermissionDecision } from '@termlnk/agent';
import type { ILogService } from '@termlnk/core';
import type { Observable } from 'rxjs';
import type { IAgentWireFormatter, IWireFormatContext } from '../wire-formatters';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Disposable, toDisposable } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';
import { GenericWireFormatter } from '../wire-formatters';

const OPENCODE_CONFIG_DIR = join(homedir(), '.config', 'opencode');
const OPENCODE_PLUGINS_DIR = join(OPENCODE_CONFIG_DIR, 'plugins');
const PLUGIN_FILE = join(OPENCODE_PLUGINS_DIR, 'termlnk-hooks.mjs');

/**
 * OpenCode adapter — installs a native OpenCode plugin for hook integration.
 *
 * Writes an ESM plugin to `~/.config/opencode/plugins/` that OpenCode
 * auto-loads at startup. The plugin uses both the generic `event` handler
 * (session lifecycle) and named hooks (`tool.execute.before/after`,
 * `permission.ask`, etc.) to forward structured data to the termlnk
 * launcher via stdin.
 */
export class OpenCodeHookAdapter extends Disposable implements IAgentHookAdapter {
  readonly agentType: ExternalAgentType = 'opencode';

  readonly definition: IAgentHookDefinition = {
    name: 'opencode',
    displayName: 'OpenCode',
    configDir: '.config/opencode',
    configFile: 'plugins/termlnk-hooks.mjs',
    disableEnvVar: 'TERMLNK_OPENCODE_HOOKS_DISABLED',
    format: { type: 'plugin-config' },
    events: [
      { agentEvent: 'session.created', termlnkEvent: 'session-start' },
      { agentEvent: 'session.idle', termlnkEvent: 'stop' },
      { agentEvent: 'session.deleted', termlnkEvent: 'session-end' },
      { agentEvent: 'session.error', termlnkEvent: 'notification' },
      { agentEvent: 'session.compacted', termlnkEvent: 'pre-compact' },
      { agentEvent: 'message.updated', termlnkEvent: 'prompt-submit' },
      { agentEvent: 'permission.asked', termlnkEvent: 'notification' },
      { agentEvent: 'todo.updated', termlnkEvent: 'notification' },
      { agentEvent: 'tool.execute.before', termlnkEvent: 'pre-tool-use' },
      { agentEvent: 'tool.execute.after', termlnkEvent: 'post-tool-use' },
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

  parseQuestion(_toolName: string, _toolInput: Record<string, unknown>): IAskUserQuestion | null {
    return null;
  }

  formatResponse(decision: IPermissionDecision, context: IWireFormatContext): string {
    return this._wireFormatter.formatResponse(decision, context);
  }

  async install(_port: number, _token: string): Promise<void> {
    try {
      mkdirSync(OPENCODE_PLUGINS_DIR, { recursive: true });
      writeFileSync(PLUGIN_FILE, this._generatePluginScript(), 'utf-8');

      this._installed$.next(true);
      this._logService.log('[OpenCodeAdapter]', `Plugin installed at ${PLUGIN_FILE}`);
    } catch (err) {
      this._logService.warn('[OpenCodeAdapter]', 'Failed to install plugin:', err);
    }
  }

  async uninstall(): Promise<void> {
    try {
      if (existsSync(PLUGIN_FILE)) {
        unlinkSync(PLUGIN_FILE);
      }
      this._installed$.next(false);
      this._logService.log('[OpenCodeAdapter]', 'Plugin uninstalled');
    } catch (err) {
      this._logService.warn('[OpenCodeAdapter]', 'Failed to uninstall plugin:', err);
    }
  }

  async isAvailable(): Promise<boolean> {
    return existsSync(OPENCODE_CONFIG_DIR);
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

  /**
   * Generate the ESM plugin module. Bakes in the launcher path at install
   * time; the launcher handles server discovery and session-id synthesis.
   */
  private _generatePluginScript(): string {
    const escapedLauncher = JSON.stringify(this._launcherPath);
    return `// termlnk OpenCode hook plugin — auto-generated. Do not edit manually.
// TERMLNK_HOOK

import { spawn } from 'node:child_process';

const LAUNCHER = ${escapedLauncher};

function forward(termlnkEvent, payload) {
  try {
    const child = spawn(LAUNCHER, ['--agent', 'opencode', '--event', termlnkEvent], {
      stdio: ['pipe', 'ignore', 'ignore'],
      detached: true,
    });
    child.on('error', () => {});
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(payload || {}));
    child.unref();
  } catch {
    // Silently ignore — the launcher may not be installed yet
  }
}

function safeExtract(event, ctx) {
  const result = {};
  if (event && typeof event === 'object') {
    for (const key of Object.keys(event)) {
      const val = event[key];
      if (val == null) {
        continue;
      }
      const t = typeof val;
      if (t === 'string' || t === 'number' || t === 'boolean') {
        result[key] = val;
      } else if (t === 'object') {
        try { result[key] = JSON.parse(JSON.stringify(val)); } catch {}
      }
    }
  }
  if (ctx && ctx.directory) {
    result.cwd = ctx.directory;
  }
  return result;
}

// Skip events handled via named hooks to avoid duplicates.
const SKIP_IN_GENERIC = new Set([
  'tool.execute.before',
  'tool.execute.after',
  'permission.asked',
  'permission.replied',
]);

// Generic Bus events → termlnk unified event types.
const EVENT_MAP = {
  'session.created': 'session-start',
  'session.idle': 'stop',
  'session.deleted': 'session-end',
  'session.error': 'notification',
  'session.compacted': 'pre-compact',
  'message.updated': 'prompt-submit',
  'permission.asked': 'notification',
  'todo.updated': 'notification',
};

export const TermlnkHooksPlugin = async (ctx) => {
  return {
    event: async ({ event }) => {
      if (!event || SKIP_IN_GENERIC.has(event.type)) {
        return;
      }
      const mapped = EVENT_MAP[event.type];
      if (!mapped) {
        return;
      }
      forward(mapped, safeExtract(event, ctx));
    },

    'tool.execute.before': async (input, output) => {
      forward('pre-tool-use', {
        type: 'tool.execute.before',
        tool_name: input.tool,
        tool_input: output.args || {},
        session_id: input.sessionID,
        call_id: input.callID,
        cwd: ctx.directory,
      });
    },

    'tool.execute.after': async (input) => {
      forward('post-tool-use', {
        type: 'tool.execute.after',
        tool_name: input.tool,
        session_id: input.sessionID,
        call_id: input.callID,
        cwd: ctx.directory,
      });
    },

    'permission.ask': async (input) => {
      forward('permission-request', {
        type: 'permission.asked',
        tool_name: (input && input.tool) || 'unknown',
        tool_input: (input && input.input) || {},
        cwd: ctx.directory,
      });
    },

    'experimental.session.compacting': async (input) => {
      forward('pre-compact', {
        type: 'session.compacted',
        session_id: input.sessionID,
        cwd: ctx.directory,
      });
    },

    'chat.message': async (input) => {
      forward('prompt-submit', {
        type: 'message.updated',
        session_id: input.sessionID,
        cwd: ctx.directory,
      });
    },
  };
};

export default TermlnkHooksPlugin;
`;
  }
}
