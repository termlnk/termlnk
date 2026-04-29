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

import type { ICommandPermissionService } from '@termlnk/agent';
import { IAgentToolRegistryService, ICommandPermissionService as ICommandPermissionServiceId } from '@termlnk/agent';
import { Disposable, ILogService, Inject, Injector } from '@termlnk/core';
import { ISSHToolService } from '@termlnk/rpc';
import { IPTYSessionService } from '@termlnk/terminal';
import { ICommandBlockService } from '../services/shell-integration/command-block.service';
import { registerFileTools } from '../tools/file-tools';
import { registerHostTools } from '../tools/host-tools';
import { registerTerminalTools } from '../tools/terminal-tools';

export class McpToolsController extends Disposable {
  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @IAgentToolRegistryService private readonly _toolRegistryService: IAgentToolRegistryService,
    @ISSHToolService private readonly _sshToolService: ISSHToolService,
    @ICommandBlockService private readonly _commandBlockService: ICommandBlockService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();

    this._registerTools();
  }

  private _registerTools(): void {
    try {
      let ptySessionService: IPTYSessionService | undefined;
      try {
        ptySessionService = this._injector.get(IPTYSessionService);
      } catch {
        this._logService.log('[McpToolsController]', 'PTY session service not available');
      }

      let permissionService: ICommandPermissionService | undefined;
      try {
        permissionService = this._injector.get(ICommandPermissionServiceId);
      } catch {
        this._logService.log('[McpToolsController]', 'Permission service not available');
      }

      const terminalDisposables = registerTerminalTools(
        {
          sshToolService: this._sshToolService,
          logService: this._logService,
          ptySessionService,
          permissionService,
          commandBlockService: this._commandBlockService,
        },
        this._toolRegistryService
      );
      for (const d of terminalDisposables) {
        this.disposeWithMe(d);
      }

      const hostDisposables = registerHostTools(
        this._toolRegistryService,
        this._sshToolService,
        this._logService
      );
      for (const d of hostDisposables) {
        this.disposeWithMe(d);
      }

      const fileDisposables = registerFileTools(
        this._toolRegistryService,
        this._injector,
        this._logService
      );
      for (const d of fileDisposables) {
        this.disposeWithMe(d);
      }

      this._logService.log('[McpToolsController]', 'Built-in host/terminal/file tools registered.');
    } catch (err) {
      this._logService.warn('[McpToolsController]', 'Failed to register MCP tools:', err);
    }
  }
}
