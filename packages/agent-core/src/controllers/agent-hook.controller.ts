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

import type { IAgentHookConfig } from '@termlnk/agent';
import process from 'node:process';
import { AGENT_HOOK_CONFIG_KEY, DEFAULT_AGENT_HOOK_CONFIG, IAgentHookRegistryService, IAgentHookServerService, IAgentMonitorService, IHookLauncherService } from '@termlnk/agent';
import { Disposable, IConfigService, ILogService, Inject, Injector } from '@termlnk/core';
import { ITerminalSessionNotifyService } from '@termlnk/rpc';
import { ClaudeCodeHookAdapter } from '../services/hook/adapters/claude-code-adapter';
import { CodeBuddyHookAdapter } from '../services/hook/adapters/codebuddy-adapter';
import { CodexHookAdapter } from '../services/hook/adapters/codex-adapter';
import { CopilotHookAdapter } from '../services/hook/adapters/copilot-adapter';
import { CursorHookAdapter } from '../services/hook/adapters/cursor-adapter';
import { GeminiHookAdapter } from '../services/hook/adapters/gemini-adapter';
import { KimiCodeHookAdapter } from '../services/hook/adapters/kimi-code-adapter';
import { OpenCodeHookAdapter } from '../services/hook/adapters/opencode-adapter';

export class AgentHookController extends Disposable {
  constructor(
    @IHookLauncherService private readonly _hookLauncherService: IHookLauncherService,
    @IAgentHookServerService private readonly _hookServerService: IAgentHookServerService,
    @IAgentHookRegistryService private readonly _hookRegistryService: IAgentHookRegistryService,
    @IAgentMonitorService private readonly _agentMonitorService: IAgentMonitorService,
    @ITerminalSessionNotifyService private readonly _sessionNotifyService: ITerminalSessionNotifyService,
    @IConfigService private readonly _configService: IConfigService,
    @ILogService private readonly _logService: ILogService,
    @Inject(Injector) private readonly _injector: Injector
  ) {
    super();

    this._initAdapters();
    this._initServer();
    this._initExternalMonitor();
    this._initListeners();
  }

  private _initAdapters(): void {
    const config = this._configService.getConfig<IAgentHookConfig>(
      AGENT_HOOK_CONFIG_KEY
    ) ?? DEFAULT_AGENT_HOOK_CONFIG;

    if (!config.enabled) {
      this._logService.log('[AgentHookController]', 'Agent hooks disabled by config');
      return;
    }

    const launcherPath = this._hookLauncherService.getLauncherPath();
    const adapters = [
      this._injector.createInstance(ClaudeCodeHookAdapter, launcherPath),
      this._injector.createInstance(CodexHookAdapter, launcherPath),
      this._injector.createInstance(CursorHookAdapter, launcherPath),
      this._injector.createInstance(GeminiHookAdapter, launcherPath),
      this._injector.createInstance(CopilotHookAdapter, launcherPath),
      this._injector.createInstance(CodeBuddyHookAdapter, launcherPath),
      this._injector.createInstance(OpenCodeHookAdapter, launcherPath),
      this._injector.createInstance(KimiCodeHookAdapter, launcherPath),
    ];

    for (const adapter of adapters) {
      if (config.agents[adapter.agentType] !== false) {
        this._hookRegistryService.registerAdapter(adapter);
      }
    }
  }

  private _initServer(): void {
    this._hookLauncherService.install()
      .then(() => this._hookServerService.start())
      .then(() => {
        const port = this._hookServerService.getPort();
        const token = this._hookServerService.token;

        // Set environment variables for PTY inheritance (internal sessions).
        process.env.TERMLNK_HOOK_PORT = String(port);
        process.env.TERMLNK_HOOK_TOKEN = token;
        process.env.TERMLNK_HOOK_URL = `http://127.0.0.1:${port}/hook`;

        return this._hookRegistryService.installAll(port, token);
      })
      .catch((err) => {
        this._logService.error('[AgentHookController]', 'Failed to start hook server:', err);
      });
  }

  private _initExternalMonitor(): void {
    this._hookServerService.setExternalMonitorEnabled(true).catch((err) => {
      this._logService.warn('[AgentHookController]', 'Failed to enable external monitor:', err);
    });
  }

  private _initListeners(): void {
    // Clean up agent sessions when PTY sessions close
    this.disposeWithMe(
      this._sessionNotifyService.sessionClosed$.subscribe((event) => {
        this._agentMonitorService.removeSession(event.sessionId);
      })
    );
  }

  override dispose(): void {
    // Best-effort uninstall on shutdown
    this._hookRegistryService.uninstallAll().catch((err) => {
      this._logService.warn('[AgentHookController] uninstallAll on shutdown failed:', err);
    });

    void this._hookServerService.stop();
    super.dispose();
  }
}
