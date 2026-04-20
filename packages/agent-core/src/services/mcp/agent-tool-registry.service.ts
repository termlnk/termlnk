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

import type { IAgentTool, IAgentToolRegistryService } from '@termlnk/agent';
import type { IDisposable } from '@termlnk/core';
import { Disposable, ILogService } from '@termlnk/core';
import { BehaviorSubject } from 'rxjs';

export class AgentToolRegistryService extends Disposable implements IAgentToolRegistryService {
  private readonly _tools = new Map<string, IAgentTool>();

  private readonly _tools$ = new BehaviorSubject<IAgentTool[]>([]);
  readonly tools$ = this._tools$.asObservable();

  constructor(
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  registerTool(tool: IAgentTool): IDisposable {
    if (this._tools.has(tool.name)) {
      this._logService.warn('[AgentToolRegistryService]', `Tool "${tool.name}" is already registered, overwriting.`);
    }

    this._tools.set(tool.name, tool);
    this._emitTools();

    return this.disposeWithMe(() => {
      this._tools.delete(tool.name);
      this._emitTools();
    });
  }

  getTools(): IAgentTool[] {
    return [...this._tools.values()];
  }

  private _emitTools(): void {
    this._tools$.next([...this._tools.values()]);
  }

  override dispose(): void {
    this._tools$.complete();
    this._tools.clear();
    super.dispose();
  }
}
