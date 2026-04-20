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

import type { IDisposable } from '@termlnk/core';
import type { IToolDefinition } from '@termlnk/extension';
import { createIdentifier, Disposable, ILogService, toDisposable } from '@termlnk/core';

interface IRegisteredTool {
  readonly extensionId: string;
  readonly definition: IToolDefinition;
}

/**
 * Registry of tools contributed by extensions for the AI agent to call. The
 * adapter layer forwards `ctx.tools.register(def)` into this service; the
 * agent subsystem queries `getAll()` to populate its callable tool list.
 *
 * This keeps `@termlnk/extension-ui` decoupled from `@termlnk/agent-core` —
 * agent-core observes the registry when it needs the tool set.
 */
export interface IToolRegistryService {
  register(extensionId: string, definition: IToolDefinition): IDisposable;
  get(toolId: string): IToolDefinition | undefined;
  getAll(): ReadonlyArray<{ extensionId: string; definition: IToolDefinition }>;
  unregisterAllFor(extensionId: string): void;
}

export const IToolRegistryService = createIdentifier<IToolRegistryService>('extension.tool-registry-service');

export class ToolRegistryService extends Disposable implements IToolRegistryService {
  private readonly _tools = new Map<string, IRegisteredTool>();

  constructor(
    @ILogService private readonly _logService: ILogService
  ) {
    super();
  }

  register(extensionId: string, definition: IToolDefinition): IDisposable {
    if (this._tools.has(definition.id)) {
      this._logService.warn(
        '[ToolRegistryService]',
        `Tool "${definition.id}" already registered; skipping duplicate from ${extensionId}`
      );
      return toDisposable(() => {});
    }
    this._tools.set(definition.id, { extensionId, definition });
    return toDisposable(() => {
      const current = this._tools.get(definition.id);
      if (current?.extensionId === extensionId) {
        this._tools.delete(definition.id);
      }
    });
  }

  get(toolId: string): IToolDefinition | undefined {
    return this._tools.get(toolId)?.definition;
  }

  getAll(): ReadonlyArray<{ extensionId: string; definition: IToolDefinition }> {
    return [...this._tools.values()];
  }

  unregisterAllFor(extensionId: string): void {
    for (const [id, tool] of this._tools) {
      if (tool.extensionId === extensionId) {
        this._tools.delete(id);
      }
    }
  }

  override dispose(): void {
    super.dispose();
    this._tools.clear();
  }
}
