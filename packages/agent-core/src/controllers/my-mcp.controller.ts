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

import type { IAgentPluginConfig, IMcpConfig } from '@termlnk/agent';
import type { IProxy } from '@termlnk/terminal';
import { AGENT_PLUGIN_CONFIG_KEY, DEFAULT_MCP_CONFIG, IAgentToolRegistryService, IMyMcpService } from '@termlnk/agent';
import { Disposable, IConfigService, ILogService, Inject } from '@termlnk/core';
import { ConfigRepository } from '@termlnk/database';
import { debounceTime, filter, from, switchMap } from 'rxjs';
import { fetch as undiciFetch } from 'undici';
import { createProxyFetch } from '../services/mcp/proxy-fetch';
import { registerSystemInfoTool } from '../tools/system-info-tool';
import { registerWebFetchTool } from '../tools/web-fetch-tool';
import { registerWebSearchTool } from '../tools/web-search-tool';
import { registerWidgetTools } from '../tools/widget-tools';

const NETWORK_CONFIG_KEY = 'network.config';

export class MyMcpController extends Disposable {
  constructor(
    @Inject(ConfigRepository) private readonly _configRepository: ConfigRepository,
    @IAgentToolRegistryService private readonly _toolRegistryService: IAgentToolRegistryService,
    @IMyMcpService private readonly _myMcpService: IMyMcpService,
    @ILogService private readonly _logService: ILogService,
    @IConfigService private readonly _configService: IConfigService
  ) {
    super();

    this._registerTools();
    this._autoStart();
    this._watchConfigChanges();
  }

  private _registerTools(): void {
    try {
      // Web tools (with proxy support)
      const getFetch = async () => {
        try {
          const proxy = await this._configRepository.getField<IProxy>(NETWORK_CONFIG_KEY, 'proxy');
          if (proxy?.enabled) {
            return createProxyFetch(proxy);
          }
        } catch {
          // Proxy config unavailable, use direct fetch
        }
        return undiciFetch as unknown as (url: string | URL, init?: RequestInit) => Promise<Response>;
      };
      this.disposeWithMe(registerWebFetchTool(this._toolRegistryService, this._logService, getFetch));
      this.disposeWithMe(registerWebSearchTool(this._toolRegistryService, this._logService, getFetch));

      // System info tool
      this.disposeWithMe(registerSystemInfoTool(this._toolRegistryService, this._logService));

      // Widget tools (Generative UI Block protocol — always available regardless of session selection)
      const widgetDisposables = registerWidgetTools(this._toolRegistryService, this._logService);
      for (const d of widgetDisposables) {
        this.disposeWithMe(d);
      }

      this._logService.log('[MyMcpController]', 'Built-in network/system/widget tools registered.');
    } catch (err) {
      this._logService.warn('[MCPController]', 'Failed to register some MCP tools:', err);
    }
  }

  private _autoStart(): void {
    const sub = from(this._configRepository.getField<IMcpConfig>(AGENT_PLUGIN_CONFIG_KEY, 'mcp'))
      .subscribe((storedMcp) => {
        const mcpConfig = this._syncMcpConfig(storedMcp);

        if (mcpConfig.enabled) {
          this._myMcpService.start().catch((err) => {
            this._logService.error('[MCPController]', 'Failed to auto-start MCP server:', err);
          });
        }
      });

    this.disposeWithMe(sub);
  }

  private _watchConfigChanges(): void {
    const sub = this._configRepository.changed$.pipe(
      filter((event) => event.key === AGENT_PLUGIN_CONFIG_KEY && (event.subKey === 'mcp' || event.subKey === undefined)),
      debounceTime(500),
      switchMap(() => from(this._configRepository.getField<IMcpConfig>(AGENT_PLUGIN_CONFIG_KEY, 'mcp')))
    ).subscribe((storedMcp) => {
      const mcpConfig = this._syncMcpConfig(storedMcp);

      this._myMcpService.stop()
        .then(() => {
          if (mcpConfig.enabled) {
            return this._myMcpService.start();
          }
        })
        .catch((err) => {
          this._logService.error('[MCPController]', 'Failed to reload MCP server:', err);
        });
    });

    this.disposeWithMe(sub);
  }

  private _syncMcpConfig(storedMcp: IMcpConfig | null | undefined): IMcpConfig {
    const mcpConfig = { ...DEFAULT_MCP_CONFIG, ...storedMcp };
    const agentConfig = this._configService.getConfig<IAgentPluginConfig>(AGENT_PLUGIN_CONFIG_KEY) ?? {};
    this._configService.setConfig(AGENT_PLUGIN_CONFIG_KEY, { ...agentConfig, mcp: mcpConfig });
    return mcpConfig;
  }

  override dispose(): void {
    super.dispose();
    this._myMcpService.stop();
  }
}
